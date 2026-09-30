import "server-only";
import { sql } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createCustomerSession } from "@/lib/auth/session";
import { normalizePhone, normalizePostalCode, splitStreetAndNumber } from "@/lib/address-format";
import type { Address, Customer, CustomerAddress } from "@/lib/types";

/**
 * Customer accounts. Replaces Medusa's auth provider, its auth_identity /
 * provider_identity tables, and the actorless-token dance registration used
 * to need.
 */

export class AuthError extends Error {
  constructor(message: string, public readonly code: AuthErrorCode) {
    super(message);
  }
}
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_taken"
  | "wrong_password"
  | "not_found"
  | "rate_limited";

type CustomerRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

export function toDomainCustomer(c: CustomerRow): Customer {
  return {
    id: c.id,
    email: c.email,
    firstName: c.first_name ?? "",
    lastName: c.last_name ?? "",
    phone: c.phone ?? undefined,
  };
}

/**
 * Registration in ONE transaction.
 *
 * The Medusa version made three sequential HTTP calls (create auth identity →
 * create customer → refresh token) with no compensation, so a failure at step
 * two permanently bricked that email: re-registering said "already exists",
 * logging in succeeded at the auth layer, and then the dashboard bounced back
 * to login forever. That bug is documented in PROJECT_MEMORY.md and is
 * deleted rather than fixed — a transaction cannot half-succeed.
 */
export async function registerCustomer(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ customerId: string; token: string }> {
  const passwordHash = await hashPassword(input.password);

  const customerId = await sql.begin(async (tx) => {
    const existing = await tx<{ id: string; password_hash: string | null; has_google: boolean }[]>`
      SELECT c.id, c.password_hash,
             EXISTS (SELECT 1 FROM shop.customer_identity i WHERE i.customer_id = c.id) AS has_google
        FROM shop.customer c WHERE lower(c.email) = lower(${input.email})`;

    // An account made by "Συνέχεια με Google" has no password either, but it
    // is someone's real account, not a guest row: without this check,
    // anyone could "register" with that email, set a password, and walk
    // into it (CHECKOUT_PREFILL_GOOGLE_SPEC.md §3.3). Its owner adds a
    // password through "Ξέχασες τον κωδικό;", which proves the email is theirs.
    if (existing[0]?.password_hash || existing[0]?.has_google) {
      throw new AuthError("Email already registered", "email_taken");
    }

    // A guest who has ordered before already has a customer row with no
    // password. Registering upgrades that row in place, so their order
    // history is theirs the moment they sign up — rather than creating a
    // second, orphaned account with the same email.
    if (existing[0]) {
      await tx`
        UPDATE shop.customer
           SET password_hash = ${passwordHash}, first_name = ${input.firstName},
               last_name = ${input.lastName}
         WHERE id = ${existing[0].id}`;
      return existing[0].id;
    }

    const [created] = await tx<{ id: string }[]>`
      INSERT INTO shop.customer (email, password_hash, first_name, last_name)
      VALUES (${input.email}, ${passwordHash}, ${input.firstName}, ${input.lastName})
      RETURNING id`;
    return created.id;
  });

  return { customerId, token: await createCustomerSession(customerId) };
}

/**
 * Login. Returns the same failure for "no such account" and "wrong password"
 * so the response never reveals whether an email is registered — and runs a
 * dummy hash comparison when the account does not exist, so the two paths
 * also take the same amount of time.
 */
export async function loginCustomer(
  email: string,
  password: string
): Promise<{ customerId: string; token: string }> {
  const [c] = await sql<{ id: string; password_hash: string | null }[]>`
    SELECT id, password_hash FROM shop.customer
     WHERE lower(email) = lower(${email}) AND is_active`;

  if (!c?.password_hash) {
    // Deliberate work against a throwaway hash: without it, a missing account
    // returns noticeably faster than a wrong password, which is itself an
    // account-enumeration oracle.
    await verifyPassword(password, DUMMY_HASH);
    throw new AuthError("Invalid email or password", "invalid_credentials");
  }

  if (!(await verifyPassword(password, c.password_hash))) {
    throw new AuthError("Invalid email or password", "invalid_credentials");
  }

  return { customerId: c.id, token: await createCustomerSession(c.id) };
}

// A well-formed hash string with the same scrypt cost parameters as a real
// one. verifyPassword parses it, does the full derivation, and returns false —
// which is the entire point: it burns the same CPU as a genuine comparison so
// the "no such account" path is not measurably faster. Not a credential and
// never matches any password.
const DUMMY_HASH = "scrypt$65536$8$1$" + "0".repeat(32) + "$" + "0".repeat(128);

export async function getCustomerById(customerId: string): Promise<Customer | null> {
  const rows = await sql<CustomerRow[]>`
    SELECT id, email, first_name, last_name, phone
      FROM shop.customer WHERE id = ${customerId} AND is_active`;
  return rows[0] ? toDomainCustomer(rows[0]) : null;
}

/**
 * The account a password-reset email may be sent for: one with a password,
 * or one signed in with Google (so a Google-only customer can add a password
 * the safe way — the emailed link proves the address is theirs). A guest's
 * passwordless row is neither, and gets nothing.
 */
export async function findCustomerIdByEmail(email: string): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    SELECT c.id FROM shop.customer c
     WHERE lower(c.email) = lower(${email}) AND c.is_active
       AND (c.password_hash IS NOT NULL
            OR EXISTS (SELECT 1 FROM shop.customer_identity i WHERE i.customer_id = c.id))`;
  return rows[0]?.id ?? null;
}

/** False for an account created by Google sign-in that never set a password. */
export async function customerHasPassword(customerId: string): Promise<boolean> {
  const [row] = await sql<{ has_password: boolean }[]>`
    SELECT password_hash IS NOT NULL AS has_password FROM shop.customer WHERE id = ${customerId}`;
  return row?.has_password ?? false;
}

// ---------------------------------------------------------------------------
// "Συνέχεια με Google" (CHECKOUT_PREFILL_GOOGLE_SPEC.md §3.2)
// ---------------------------------------------------------------------------

export type GoogleSignInProfile = { subject: string; email: string; givenName: string; familyName: string };

/**
 * Which customer a verified Google sign-in belongs to, creating or linking
 * the account as needed. The caller (the callback route) has already
 * checked the ID token, including that Google verified the email.
 *
 * 1. That Google account is already linked → its customer. Matched on
 *    Google's stable `sub`, never the email, which can change on Google's
 *    side.
 * 2. A customer with the same email exists → link Google to it and sign in.
 *    Their password stays exactly as it was (owner's decision D1), and the
 *    unique index on lower(email) means a second account for that email
 *    can't exist anyway.
 * 3. Otherwise → a new customer with Google's name and no password.
 *
 * A deactivated account is refused on every path, as password login does.
 * Two first sign-ins racing each other (a double click) can both miss step 1
 * or 2 and collide on a unique key; the second is simply retried once, and
 * then finds what the first created.
 */
export async function signInWithGoogle(profile: GoogleSignInProfile): Promise<string> {
  try {
    return await resolveGoogleCustomer(profile);
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") return resolveGoogleCustomer(profile);
    throw err;
  }
}

async function resolveGoogleCustomer(profile: GoogleSignInProfile): Promise<string> {
  return sql.begin(async (tx) => {
    const [linked] = await tx<{ id: string; is_active: boolean }[]>`
      SELECT c.id, c.is_active
        FROM shop.customer_identity i
        JOIN shop.customer c ON c.id = i.customer_id
       WHERE i.provider = 'google' AND i.subject = ${profile.subject}`;
    if (linked) {
      if (!linked.is_active) throw new AuthError("Account is deactivated", "invalid_credentials");
      return linked.id;
    }

    const [existing] = await tx<{ id: string; is_active: boolean }[]>`
      SELECT id, is_active FROM shop.customer
       WHERE lower(email) = lower(${profile.email})
         FOR UPDATE`;

    let customerId: string;
    if (existing) {
      if (!existing.is_active) throw new AuthError("Account is deactivated", "invalid_credentials");
      // Only fills a name the account doesn't have yet — never overwrites
      // what the customer entered themselves.
      await tx`
        UPDATE shop.customer
           SET first_name = COALESCE(NULLIF(first_name, ''), ${profile.givenName || null}),
               last_name = COALESCE(NULLIF(last_name, ''), ${profile.familyName || null})
         WHERE id = ${existing.id}`;
      customerId = existing.id;
    } else {
      const [created] = await tx<{ id: string }[]>`
        INSERT INTO shop.customer (email, first_name, last_name)
        VALUES (${profile.email}, ${profile.givenName || null}, ${profile.familyName || null})
        RETURNING id`;
      customerId = created.id;
    }

    await tx`
      INSERT INTO shop.customer_identity (provider, subject, customer_id, email_at_link)
      VALUES ('google', ${profile.subject}, ${customerId}, ${profile.email})`;
    return customerId;
  });
}

export async function updateCustomerProfile(
  customerId: string,
  input: { firstName: string; lastName: string; phone: string }
): Promise<Customer> {
  const rows = await sql<CustomerRow[]>`
    UPDATE shop.customer
       SET first_name = ${input.firstName}, last_name = ${input.lastName},
           phone = ${normalizePhone(input.phone) || null}
     WHERE id = ${customerId}
    RETURNING id, email, first_name, last_name, phone`;
  if (!rows[0]) throw new AuthError("Customer not found", "not_found");
  return toDomainCustomer(rows[0]);
}

/** Re-verifies the current password server-side before allowing a change. */
export async function changeCustomerPassword(
  customerId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const [c] = await sql<{ password_hash: string | null }[]>`
    SELECT password_hash FROM shop.customer WHERE id = ${customerId}`;
  if (!c) throw new AuthError("Customer not found", "not_found");
  if (!(await verifyPassword(currentPassword, c.password_hash))) {
    throw new AuthError("Current password is incorrect", "wrong_password");
  }
  await setCustomerPassword(customerId, newPassword);
}

export async function setCustomerPassword(customerId: string, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  await sql`UPDATE shop.customer SET password_hash = ${hash} WHERE id = ${customerId}`;
}

// ---------------------------------------------------------------------------
// Address book
// ---------------------------------------------------------------------------

type AddressRow = {
  id: string;
  label: string | null;
  first_name: string | null;
  last_name: string | null;
  address_1: string;
  address_2: string | null;
  city: string;
  postal_code: string;
  country_code: string;
  phone: string | null;
  is_default_shipping: boolean;
};

function toDomainAddress(a: AddressRow): CustomerAddress {
  // Οδός and Αριθμός are stored combined in address_1, the same way the
  // checkout form submits them. splitStreetAndNumber takes the trailing
  // number back off for the edit form and the checkout pre-fill; saving joins
  // the two with one space again, so a wrong guess never changes the stored
  // text (see its own comment).
  const { street, number } = splitStreetAndNumber(a.address_1);
  return {
    id: a.id,
    label: a.label ?? undefined,
    isDefaultShipping: a.is_default_shipping,
    firstName: a.first_name ?? "",
    lastName: a.last_name ?? "",
    street,
    number,
    area: a.address_2 ?? undefined,
    city: a.city,
    postalCode: a.postal_code,
    countryCode: a.country_code,
    phone: a.phone ?? "",
  };
}

const ADDRESS_COLUMNS = sql`
  id, label, first_name, last_name, address_1, address_2,
  city, postal_code, country_code, phone, is_default_shipping`;

export async function listCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  const rows = await sql<AddressRow[]>`
    SELECT ${ADDRESS_COLUMNS} FROM shop.customer_address
     WHERE customer_id = ${customerId}
     ORDER BY is_default_shipping DESC, created_at`;
  return rows.map(toDomainAddress);
}

export async function addCustomerAddress(
  customerId: string,
  address: Address,
  label?: string
): Promise<void> {
  await sql`
    INSERT INTO shop.customer_address (
      customer_id, label, first_name, last_name, address_1, address_2,
      city, postal_code, country_code, phone)
    VALUES (
      ${customerId}, ${label || null}, ${address.firstName}, ${address.lastName},
      ${[address.street, address.number].filter(Boolean).join(" ")},
      ${address.area || null}, ${address.city}, ${normalizePostalCode(address.postalCode)},
      ${address.countryCode || "gr"}, ${normalizePhone(address.phone) || null})`;
}

/**
 * Checkout's "Αποθήκευση διεύθυνσης στον λογαριασμό μου"
 * (CHECKOUT_PREFILL_GOOGLE_SPEC.md §2.4). Copies the placed order's own
 * shipping address — what was actually committed, never anything the
 * browser sends — into the customer's address book, so their next checkout
 * fills itself in.
 *
 * One statement, so the checks can't race the insert: the order must belong
 * to this customer (the session's id, not a client value), an address with
 * the same street text + ΤΚ is skipped rather than duplicated (same
 * comparison as isSameAddressLine), and the first address a customer ever
 * saves becomes their default.
 */
export async function saveOrderAddressToCustomer(customerId: string, orderId: string): Promise<void> {
  await sql`
    INSERT INTO shop.customer_address (
      customer_id, first_name, last_name, address_1, address_2,
      city, postal_code, country_code, phone, is_default_shipping)
    SELECT o.customer_id,
           o.shipping_address->>'first_name', o.shipping_address->>'last_name',
           COALESCE(o.shipping_address->>'address_1', ''), o.shipping_address->>'address_2',
           COALESCE(o.shipping_address->>'city', ''), COALESCE(o.shipping_address->>'postal_code', ''),
           COALESCE(o.shipping_address->>'country_code', 'gr'), o.shipping_address->>'phone',
           NOT EXISTS (SELECT 1 FROM shop.customer_address a WHERE a.customer_id = o.customer_id)
      FROM shop.orders o
     WHERE o.id = ${orderId} AND o.customer_id = ${customerId} AND o.shipping_address IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM shop.customer_address a
          WHERE a.customer_id = o.customer_id
            AND lower(regexp_replace(btrim(a.address_1), '\\s+', ' ', 'g'))
              = lower(regexp_replace(btrim(COALESCE(o.shipping_address->>'address_1', '')), '\\s+', ' ', 'g'))
            AND regexp_replace(a.postal_code, '\\s', '', 'g')
              = regexp_replace(COALESCE(o.shipping_address->>'postal_code', ''), '\\s', '', 'g'))`;
}

// customer_id is in the WHERE clause, not just the id — so one customer can
// never edit or delete another's address by guessing a uuid.
export async function updateCustomerAddress(
  customerId: string,
  addressId: string,
  address: Address,
  label?: string
): Promise<void> {
  await sql`
    UPDATE shop.customer_address
       SET label = ${label || null}, first_name = ${address.firstName},
           last_name = ${address.lastName},
           address_1 = ${[address.street, address.number].filter(Boolean).join(" ")},
           address_2 = ${address.area || null}, city = ${address.city},
           postal_code = ${normalizePostalCode(address.postalCode)},
           country_code = ${address.countryCode || "gr"}, phone = ${normalizePhone(address.phone) || null}
     WHERE id = ${addressId} AND customer_id = ${customerId}`;
}

export async function deleteCustomerAddress(customerId: string, addressId: string): Promise<void> {
  await sql`DELETE FROM shop.customer_address WHERE id = ${addressId} AND customer_id = ${customerId}`;
}

// ---------------------------------------------------------------------------
// Loyalty coupons — read-only here; issuance happens inside completeOrder's
// own transaction (lib/db/checkout.ts). owner_customer_id is the WHERE
// clause, same IDOR-prevention shape as the address book above: a customer
// can only ever see coupons issued to their own account.
// ---------------------------------------------------------------------------

export type LoyaltyCoupon = {
  code: string;
  valueCents: number;
  isActive: boolean;
  isRedeemed: boolean;
  endsAt: string | null;
};

export async function listCustomerLoyaltyCoupons(customerId: string): Promise<LoyaltyCoupon[]> {
  const rows = await sql<
    { code: string; value: number; is_active: boolean; ends_at: Date | null; redemption_count: number }[]
  >`SELECT code, value, is_active, ends_at, redemption_count
      FROM shop.discount
     WHERE owner_customer_id = ${customerId}
     ORDER BY created_at DESC`;

  return rows.map((r) => ({
    code: r.code,
    valueCents: r.value,
    isActive: r.is_active,
    isRedeemed: r.redemption_count > 0,
    endsAt: r.ends_at ? new Date(r.ends_at).toISOString() : null,
  }));
}
