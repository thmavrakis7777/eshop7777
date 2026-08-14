import { cookies } from "next/headers";
import { getCartById } from "@/lib/db/cart";
import type { Cart } from "@/lib/types";

export const CART_ID_COOKIE = "cart_id";

export { toAddressSummary, isCartId } from "@/lib/db/cart";
export type { AddressJson } from "@/lib/db/cart";

/**
 * Read-only — safe to call from Server Components (cookies() is readable
 * there, just not writable; the cart_id cookie is only ever written from the
 * mutation Server Actions in lib/actions/cart.ts).
 *
 * Never throws. getCart() is called from RootLayout, so an unhandled error
 * here would take down every page on the site.
 */
export async function getCart(): Promise<Cart | null> {
  const cartId = (await cookies()).get(CART_ID_COOKIE)?.value;
  return getCartById(cartId);
}
