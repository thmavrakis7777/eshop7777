import { NextResponse } from "next/server";
import { getCart } from "@/lib/data/cart";
import { getCustomerId } from "@/lib/data/customer";

/**
 * The visitor's own state, for SessionProvider: GET /api/session →
 * `{ cart, isLoggedIn, readAt }`.
 *
 * The storefront layout used to read both cookies itself, which made every
 * page on the shop render per request — nothing could be cached, and one
 * homepage visit cost ~57 function runs (PAGE_CACHING_SPEC.md). Moving the
 * two reads here lets the pages be cached on the CDN while this stays a
 * small, uncached answer the browser asks for once per visit (plus after
 * login, logout and checkout).
 *
 * `readAt` is the server's clock at the moment of reading, the same clock
 * Cart.fetchedAt uses: a `cart: null` answer carries no fetchedAt of its own,
 * and SessionProvider needs to know whether that null is older than a cart
 * an add-to-cart created while this request was in flight.
 *
 * Both reads never throw (lib/data/cart.ts, lib/data/customer.ts), so this
 * answers 200 with "no cart, signed out" rather than an error page when the
 * database is unreachable — the shop still renders either way.
 */
export async function GET() {
  const readAt = Date.now();
  const [cart, customerId] = await Promise.all([getCart(), getCustomerId()]);
  return NextResponse.json(
    { cart, isLoggedIn: customerId !== null, readAt },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
