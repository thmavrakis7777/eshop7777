"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuthError,
  addCustomerAddress,
  changeCustomerPassword,
  deleteCustomerAddress,
  findCustomerIdByEmail,
  loginCustomer,
  registerCustomer,
  setCustomerPassword,
  updateCustomerAddress,
  updateCustomerProfile,
} from "@/lib/db/customer";
import {
  CUSTOMER_SESSION_COOKIE,
  checkRateLimit,
  consumePasswordResetToken,
  cookieOptions,
  createCustomerSession,
  createPasswordResetToken,
  destroyAllCustomerSessions,
  destroyCustomerSession,
  rateLimitKey,
} from "@/lib/auth/session";
import { getCustomerAddresses, getCustomerId } from "@/lib/data/customer";
import { sendPasswordResetEmail } from "@/lib/email/send";
import { isValidEmail, isValidPassword, isRequired, isValidPostalCode } from "@/lib/checkout-validation";
import type { Address, Customer, CustomerAddress } from "@/lib/types";

const RATE_LIMITED = "Πάρα πολλές προσπάθειες. Δοκίμασε ξανά σε λίγο.";

function mapAuthError(err: unknown): string {
  if (err instanceof AuthError) {
    switch (err.code) {
      case "invalid_credentials":
        return "Λάθος email ή κωδικός πρόσβασης.";
      case "email_taken":
        return "Υπάρχει ήδη λογαριασμός με αυτό το email.";
      case "wrong_password":
        return "Ο τρέχων κωδικός δεν είναι σωστός.";
      case "rate_limited":
        return RATE_LIMITED;
      case "not_found":
        return "Η σύνδεσή σου έληξε. Συνδέσου ξανά.";
    }
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}

async function setSessionCookie(token: string) {
  (await cookies()).set(CUSTOMER_SESSION_COOKIE, token, cookieOptions);
}

export type AuthActionResult = { ok: true } | { ok: false; error: string };
export type CustomerActionResult = { ok: true; customer: Customer } | { ok: false; error: string };
export type AddressActionResult = { ok: true; addresses: CustomerAddress[] } | { ok: false; error: string };

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

  if (!(await checkRateLimit(await rateLimitKey("register"), 5, 3600))) {
    return { ok: false, error: RATE_LIMITED };
  }

  try {
    const { token } = await registerCustomer({ email, password, firstName, lastName });
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

  if (!(await checkRateLimit(await rateLimitKey("login"), 10, 900))) {
    return { ok: false, error: RATE_LIMITED };
  }

  try {
    const token = await loginCustomer(email, password);
    await setSessionCookie(token);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  // Delete the row, not just the cookie — otherwise the token stays valid for
  // anyone who captured it.
  await destroyCustomerSession(jar.get(CUSTOMER_SESSION_COOKIE)?.value);
  jar.delete(CUSTOMER_SESSION_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Always reports success, whether or not the email exists — otherwise this
 * endpoint is an account-enumeration oracle. Mirrors what Medusa's own route
 * did deliberately, and keeps that property now that we own the code.
 */
export async function requestPasswordResetAction(email: string): Promise<AuthActionResult> {
  if (!isValidEmail(email)) return { ok: false, error: "Μη έγκυρη διεύθυνση email." };
  if (!(await checkRateLimit(await rateLimitKey("reset"), 5, 3600))) return { ok: true };

  try {
    const customerId = await findCustomerIdByEmail(email);
    if (customerId) {
      const token = await createPasswordResetToken(customerId);
      await sendPasswordResetEmail(email, token);
    }
  } catch {
    // Swallowed on purpose: a failure here must not distinguish a real
    // account from an unknown one.
  }
  return { ok: true };
}

export async function confirmPasswordResetAction(input: {
  token: string;
  password: string;
}): Promise<AuthActionResult> {
  const { token, password } = input;
  if (!isValidPassword(password)) return { ok: false, error: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες." };
  if (!isRequired(token)) return { ok: false, error: "Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος." };

  try {
    const customerId = await consumePasswordResetToken(token);
    // Expired, already used, or forged all read the same to the customer:
    // get a fresh link.
    if (!customerId) {
      return { ok: false, error: "Ο σύνδεσμος έχει λήξει ή έχει ήδη χρησιμοποιηθεί. Ζήτησε νέο." };
    }
    await setCustomerPassword(customerId, password);
    // Anyone holding a session for this account loses it — the whole point of
    // resetting a password you believe is compromised.
    await destroyAllCustomerSessions(customerId);
    return { ok: true };
  } catch {
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

  const customerId = await getCustomerId();
  if (!customerId) return { ok: false, error: "Η σύνδεσή σου έληξε. Συνδέσου ξανά." };

  try {
    await changeCustomerPassword(customerId, currentPassword, newPassword);
    // Every other session dies, then this browser gets a fresh one so the
    // customer isn't logged out of the tab they just used.
    await destroyAllCustomerSessions(customerId);
    await setSessionCookie(await createCustomerSession(customerId));
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
  if (!isRequired(input.firstName) || !isRequired(input.lastName)) {
    return { ok: false, error: "Συμπλήρωσε όνομα και επώνυμο." };
  }
  const customerId = await getCustomerId();
  if (!customerId) return { ok: false, error: "Η σύνδεσή σου έληξε. Συνδέσου ξανά." };

  try {
    const customer = await updateCustomerProfile(customerId, input);
    revalidatePath("/logariasmos");
    return { ok: true, customer };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

async function addressResultFrom(run: (customerId: string) => Promise<unknown>): Promise<AddressActionResult> {
  const customerId = await getCustomerId();
  if (!customerId) return { ok: false, error: "Η σύνδεσή σου έληξε. Συνδέσου ξανά." };
  try {
    await run(customerId);
    revalidatePath("/logariasmos/diefthinseis");
    return { ok: true, addresses: await getCustomerAddresses() };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

function validAddress(a: Address): boolean {
  return isRequired(a.street) && isRequired(a.city) && isValidPostalCode(a.postalCode);
}

export async function addAddressAction(address: Address, label?: string): Promise<AddressActionResult> {
  if (!validAddress(address)) return { ok: false, error: "Συμπλήρωσε σωστά όλα τα στοιχεία της διεύθυνσης." };
  return addressResultFrom((id) => addCustomerAddress(id, address, label));
}

export async function updateAddressAction(
  addressId: string,
  address: Address,
  label?: string
): Promise<AddressActionResult> {
  if (!validAddress(address)) return { ok: false, error: "Συμπλήρωσε σωστά όλα τα στοιχεία της διεύθυνσης." };
  return addressResultFrom((id) => updateCustomerAddress(id, addressId, address, label));
}

export async function deleteAddressAction(addressId: string): Promise<AddressActionResult> {
  return addressResultFrom((id) => deleteCustomerAddress(id, addressId));
}
