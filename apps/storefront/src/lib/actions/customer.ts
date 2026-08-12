"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { medusaFetch, MedusaApiError, type MedusaCustomer } from "@/lib/medusa";
import { CUSTOMER_JWT_COOKIE, getCustomerAddresses, toDomainCustomer } from "@/lib/data/customer";
import { isValidEmail, isValidPassword, isRequired, isValidPostalCode } from "@/lib/checkout-validation";
import type { Address, Customer, CustomerAddress } from "@/lib/types";

// httpOnly/secure/sameSite=lax — same reasoning and same shape as
// lib/actions/cart.ts's CART_ID_COOKIE. 7 days: this session just needs a
// fresh login after expiry, not a hard security boundary — matches
// Medusa's own default jwtExpiresIn ballpark for a storefront session.
const JWT_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

async function setSessionCookie(token: string) {
  (await cookies()).set(CUSTOMER_JWT_COOKIE, token, {
    maxAge: JWT_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

async function requireToken(): Promise<string> {
  const token = (await cookies()).get(CUSTOMER_JWT_COOKIE)?.value;
  if (!token) throw new MedusaApiError("Not authenticated", "unauthorized", "unauthorized", 401);
  return token;
}

// Exact strings straight from @medusajs/auth-emailpass's service
// implementation (read from the installed package, not guessed) — Medusa
// deliberately returns the same "Invalid email or password" for both
// "no such account" and "wrong password" (doesn't leak which one), so this
// maps to the same single Greek message either way.
function mapAuthError(err: unknown): string {
  if (err instanceof MedusaApiError) {
    if (/invalid email or password/i.test(err.message)) return "Λάθος email ή κωδικός πρόσβασης.";
    if (/already exists/i.test(err.message)) return "Υπάρχει ήδη λογαριασμός με αυτό το email.";
    if (/current password is incorrect/i.test(err.message)) return "Ο τρέχων κωδικός δεν είναι σωστός.";
    if (err.status === 401) return "Η σύνδεσή σου έληξε. Συνδέσου ξανά.";
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}

export type AuthActionResult = { ok: true } | { ok: false; error: string };
export type CustomerActionResult = { ok: true; customer: Customer } | { ok: false; error: string };

export async function registerAction(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<AuthActionResult> {
  const { email, password, firstName, lastName } = input;
  if (!isValidEmail(email)) return { ok: false, error: "Μη έγκυρη διεύθυνση email." };
  if (!isValidPassword(password)) return { ok: false, error: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες." };
  if (!isRequired(firstName) || !isRequired(lastName)) return { ok: false, error: "Συμπλήρωσε όνομα και επώνυμο." };

  try {
    // Register → create the customer record with the actorless token →
    // refresh to get a token with the new customer attached. Three real
    // Medusa Store/Auth API calls, no shortcuts — verified against the
    // installed @medusajs/medusa route source, not assumed from memory.
    const { token: actorlessToken } = await medusaFetch<{ token: string }>("/auth/customer/emailpass/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    await medusaFetch<{ customer: MedusaCustomer }>("/store/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${actorlessToken}` },
      body: JSON.stringify({ email, first_name: firstName, last_name: lastName }),
    });

    const { token } = await medusaFetch<{ token: string }>("/auth/token/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${actorlessToken}` },
    });

    await setSessionCookie(token);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export async function loginAction(input: { email: string; password: string }): Promise<AuthActionResult> {
  const { email, password } = input;
  if (!isValidEmail(email) || !isRequired(password)) {
    return { ok: false, error: "Συμπλήρωσε email και κωδικό πρόσβασης." };
  }

  try {
    const { token } = await medusaFetch<{ token: string }>("/auth/customer/emailpass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    await setSessionCookie(token);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(CUSTOMER_JWT_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordResetAction(email: string): Promise<AuthActionResult> {
  if (!isValidEmail(email)) return { ok: false, error: "Μη έγκυρη διεύθυνση email." };

  try {
    // Always returns { ok: true } regardless of outcome — Medusa's own
    // reset-password route runs with throwOnError: false specifically so it
    // never leaks whether an account exists for this email; mirroring that
    // here on the storefront side, not just relying on the backend's
    // behavior. (This also swallows the empty-201-body JSON-parse artifact
    // medusaFetch's unconditional res.json() hits on this endpoint's plain
    // "Created" response — harmless, still lands here as caught, still ok:true.)
    await medusaFetch("/auth/customer/emailpass/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email }),
    });
  } catch {
    // Intentionally ignored — see comment above.
  }
  return { ok: true };
}

export async function confirmPasswordResetAction(input: { token: string; password: string }): Promise<AuthActionResult> {
  const { token, password } = input;
  if (!isValidPassword(password)) return { ok: false, error: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες." };
  if (!isRequired(token)) return { ok: false, error: "Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος." };

  try {
    await medusaFetch("/auth/customer/emailpass/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    });
    return { ok: true };
  } catch {
    // The reset token is single-use and 15-minute-lived (consumed
    // atomically by Medusa's validateToken middleware on first use) — any
    // failure here (expired, already used, malformed) reads the same to
    // the customer: get a fresh link.
    return { ok: false, error: "Ο σύνδεσμος έχει λήξει ή έχει ήδη χρησιμοποιηθεί. Ζήτησε νέο." };
  }
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<AuthActionResult> {
  const { currentPassword, newPassword } = input;
  if (!isValidPassword(newPassword)) return { ok: false, error: "Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες." };
  if (!isRequired(currentPassword)) return { ok: false, error: "Συμπλήρωσε τον τρέχοντα κωδικό." };

  try {
    const token = await requireToken();
    await medusaFetch("/store/customers/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export async function updateProfileAction(input: {
  firstName: string;
  lastName: string;
  phone: string;
}): Promise<CustomerActionResult> {
  const { firstName, lastName, phone } = input;
  if (!isRequired(firstName) || !isRequired(lastName)) {
    return { ok: false, error: "Συμπλήρωσε όνομα και επώνυμο." };
  }

  try {
    const token = await requireToken();
    const { customer } = await medusaFetch<{ customer: MedusaCustomer }>("/store/customers/me", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, phone: phone || null }),
    });
    revalidatePath("/logariasmos");
    return { ok: true, customer: toDomainCustomer(customer) };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export type AddressActionResult = { ok: true; addresses: CustomerAddress[] } | { ok: false; error: string };

function mapAddressPayload(address: Address, label?: string) {
  return {
    address_name: label || undefined,
    first_name: address.firstName,
    last_name: address.lastName,
    // Same Οδός/Αριθμός-combine as lib/actions/checkout.ts's checkout
    // address save — one address_1 string, split back apart on read isn't
    // reliable, so it isn't attempted (see toDomainCustomerAddress).
    address_1: [address.street, address.number].filter(Boolean).join(" "),
    address_2: address.area || null,
    city: address.city,
    postal_code: address.postalCode,
    country_code: address.countryCode || "gr",
    phone: address.phone || null,
  };
}

async function addressResultFrom(run: (token: string) => Promise<unknown>): Promise<AddressActionResult> {
  try {
    const token = await requireToken();
    await run(token);
    revalidatePath("/logariasmos/diefthinseis");
    return { ok: true, addresses: await getCustomerAddresses() };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export async function addAddressAction(address: Address, label?: string): Promise<AddressActionResult> {
  if (!isRequired(address.street) || !isRequired(address.city) || !isValidPostalCode(address.postalCode)) {
    return { ok: false, error: "Συμπλήρωσε σωστά όλα τα στοιχεία της διεύθυνσης." };
  }
  return addressResultFrom((token) =>
    medusaFetch("/store/customers/me/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(mapAddressPayload(address, label)),
    })
  );
}

export async function updateAddressAction(addressId: string, address: Address, label?: string): Promise<AddressActionResult> {
  if (!isRequired(address.street) || !isRequired(address.city) || !isValidPostalCode(address.postalCode)) {
    return { ok: false, error: "Συμπλήρωσε σωστά όλα τα στοιχεία της διεύθυνσης." };
  }
  return addressResultFrom((token) =>
    medusaFetch(`/store/customers/me/addresses/${addressId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(mapAddressPayload(address, label)),
    })
  );
}

export async function deleteAddressAction(addressId: string): Promise<AddressActionResult> {
  return addressResultFrom((token) =>
    medusaFetch(`/store/customers/me/addresses/${addressId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}
