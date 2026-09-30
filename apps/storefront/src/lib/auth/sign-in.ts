import "server-only";
import { cookies } from "next/headers";
import { CUSTOMER_SESSION_COOKIE, cookieOptions, createCustomerSession } from "@/lib/auth/session";
import { CART_ID_COOKIE, isCartId } from "@/lib/data/cart";
import { mergeGuestCartIntoCustomer } from "@/lib/db/cart";
import { setCartIdCookie } from "@/lib/actions/cart";

// What every way of signing in does once the customer is known — password
// login and registration (lib/actions/customer.ts) and Google sign-in
// (app/api/auth/google/callback). Lives outside the "use server" actions
// file on purpose: an exported function there would itself become a Server
// Action any browser could call with any customer id.

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(CUSTOMER_SESSION_COOKIE, token, cookieOptions);
}

/**
 * Runs right after login/register. A guest's cart is a cookie the merge
 * code can read directly (no client involvement needed, unlike the
 * wishlist — see mergeWishlistOnLoginAction — which lives in localStorage
 * and has to be merged from the client instead). Best-effort: a merge
 * failure must never turn a successful login into a failed one, so errors
 * are logged and swallowed, not surfaced.
 */
export async function mergeGuestCart(customerId: string): Promise<void> {
  const guestCartId = (await cookies()).get(CART_ID_COOKIE)?.value;
  if (!isCartId(guestCartId)) return;
  try {
    const mergedCartId = await mergeGuestCartIntoCustomer(customerId, guestCartId);
    if (mergedCartId !== guestCartId) await setCartIdCookie(mergedCartId);
  } catch (err) {
    console.error("[customer] CART_MERGE_FAILED", { error: String(err) });
  }
}

/** A fresh session for this customer, plus the guest cart carried over. */
export async function startCustomerSession(customerId: string): Promise<void> {
  await setSessionCookie(await createCustomerSession(customerId));
  await mergeGuestCart(customerId);
}
