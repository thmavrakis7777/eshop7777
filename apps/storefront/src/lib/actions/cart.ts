"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  CartError,
  addItem,
  applyDiscount,
  createCart,
  isCartId,
  removeDiscount,
  removeItem,
  updateItemQuantity,
} from "@/lib/db/cart";
import { CART_ID_COOKIE, getCart } from "@/lib/data/cart";
import { checkRateLimit, rateLimitKey } from "@/lib/auth/session";
import type { Cart } from "@/lib/types";

// Guest cart persists across visits, not just one browser session — 30 days
// is a reasonable "gave up on this cart" horizon without being forever, and
// matches shop.cart.expires_at's default.
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

async function getOrCreateCartId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CART_ID_COOKIE)?.value;
  // A non-uuid value is a leftover Medusa cart id from before the migration —
  // replaced rather than trusted, so a returning shopper silently gets a
  // fresh cart instead of an error.
  if (isCartId(existing)) return existing;

  const id = await createCart();
  // httpOnly: nothing client-side reads this cookie — the cart is always
  // resolved server-side — so keeping it out of `document.cookie` removes it
  // as an XSS target at no cost.
  jar.set(CART_ID_COOKIE, id, {
    maxAge: CART_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return id;
}

// Maps real error codes to the Greek copy table in CART_UX_SPEC.md §14.
// Never let a raw database or HTTP message reach a customer.
function mapCartError(err: unknown): string {
  if (err instanceof CartError) {
    switch (err.code) {
      case "insufficient_inventory":
        return "Δεν υπάρχει αρκετό απόθεμα για αυτή την ποσότητα.";
      case "expired_code":
        return "Ο κωδικός έχει λήξει.";
      case "invalid_code":
        return "Ο κωδικός δεν είναι έγκυρος.";
      case "min_subtotal":
        return "Το καλάθι σου δεν φτάνει το ελάχιστο ποσό για αυτόν τον κωδικό.";
      case "not_found":
        return "Αυτό το προϊόν δεν είναι πλέον διαθέσιμο.";
    }
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}

export type CartActionResult = { ok: true; cart: Cart } | { ok: false; error: string; cart: Cart | null };

async function resultFrom(run: () => Promise<unknown>): Promise<CartActionResult> {
  try {
    await run();
    revalidatePath("/", "layout");
    const cart = await getCart();
    // The mutation succeeded but the cart vanished underneath us (pruned
    // between write and read-back) — surface the same "expired" state the UI
    // already knows how to show.
    if (!cart) return { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ένα νέο.", cart: null };
    return { ok: true, cart };
  } catch (err) {
    return { ok: false, error: mapCartError(err), cart: await getCart() };
  }
}

async function requireCartId(): Promise<string | null> {
  const id = (await cookies()).get(CART_ID_COOKIE)?.value;
  return isCartId(id) ? id : null;
}

const EXPIRED: CartActionResult = { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ένα νέο.", cart: null };

export async function getCartAction(): Promise<Cart | null> {
  return getCart();
}

export async function addLineItemAction(variantId: string, quantity = 1): Promise<CartActionResult> {
  return resultFrom(async () => {
    const cartId = await getOrCreateCartId();
    await addItem(cartId, variantId, quantity);
  });
}

export async function updateLineItemQuantityAction(lineItemId: string, quantity: number): Promise<CartActionResult> {
  const cartId = await requireCartId();
  if (!cartId) return EXPIRED;
  return resultFrom(() => updateItemQuantity(cartId, lineItemId, quantity));
}

export async function removeLineItemAction(lineItemId: string): Promise<CartActionResult> {
  const cartId = await requireCartId();
  if (!cartId) return EXPIRED;
  return resultFrom(() => removeItem(cartId, lineItemId));
}

export async function applyPromoCodeAction(code: string): Promise<CartActionResult> {
  const cartId = await requireCartId();
  if (!cartId) return EXPIRED;
  // Unauthenticated, unlimited-guess codes are an enumeration surface — a
  // typo-retry budget is generous, a scripted sweep of the codespace is not.
  if (!(await checkRateLimit(await rateLimitKey("promo-code"), 20, 300))) {
    return { ok: false, error: "Πάρα πολλές προσπάθειες. Δοκίμασε ξανά σε λίγο.", cart: await getCart() };
  }
  return resultFrom(() => applyDiscount(cartId, code));
}

export async function removePromoCodeAction(code: string): Promise<CartActionResult> {
  const cartId = await requireCartId();
  if (!cartId) return EXPIRED;
  return resultFrom(() => removeDiscount(cartId, code));
}
