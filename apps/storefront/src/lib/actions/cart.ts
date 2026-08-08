"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDefaultRegionId, medusaFetch, MedusaApiError, type MedusaCart } from "@/lib/medusa";
import { CART_ID_COOKIE, getCart } from "@/lib/data/cart";
import type { Cart } from "@/lib/types";

// Guest cart persists across visits, not just one browser session — 30 days
// is a reasonable "gave up on this cart" horizon without being forever.
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

async function getOrCreateCartId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CART_ID_COOKIE)?.value;
  if (existing) return existing;

  const regionId = await getDefaultRegionId();
  const { cart } = await medusaFetch<{ cart: MedusaCart }>("/store/carts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region_id: regionId }),
  });
  jar.set(CART_ID_COOKIE, cart.id, { maxAge: CART_COOKIE_MAX_AGE, sameSite: "lax", path: "/" });
  return cart.id;
}

// Maps Medusa's real error shapes (verified against the live Store API
// during Phase 4A — see CHANGELOG.md) to the Greek copy table in
// CART_UX_SPEC.md §14. Never let a raw Medusa/HTTP message reach a customer.
function mapCartError(err: unknown): string {
  if (err instanceof MedusaApiError) {
    if (err.code === "insufficient_inventory") {
      return "Δεν υπάρχει αρκετό απόθεμα για αυτή την ποσότητα.";
    }
    if (err.type === "invalid_data" && /expired/i.test(err.message)) {
      return "Ο κωδικός έχει λήξει.";
    }
    if (err.type === "invalid_data") {
      return "Ο κωδικός δεν είναι έγκυρος.";
    }
    if (err.status === 404) {
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
    // The mutation itself succeeded but the cart vanished underneath us
    // (e.g. pruned between the write and the read-back) — surface it as
    // the same "expired" state the UI already knows how to show.
    if (!cart) return { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ένα νέο.", cart: null };
    return { ok: true, cart };
  } catch (err) {
    return { ok: false, error: mapCartError(err), cart: await getCart() };
  }
}

export async function getCartAction(): Promise<Cart | null> {
  return getCart();
}

export async function addLineItemAction(variantId: string, quantity = 1): Promise<CartActionResult> {
  return resultFrom(async () => {
    const cartId = await getOrCreateCartId();
    await medusaFetch(`/store/carts/${cartId}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant_id: variantId, quantity }),
    });
  });
}

export async function updateLineItemQuantityAction(lineItemId: string, quantity: number): Promise<CartActionResult> {
  const cartId = (await cookies()).get(CART_ID_COOKIE)?.value;
  if (!cartId) return { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ένα νέο.", cart: null };
  return resultFrom(() =>
    medusaFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    })
  );
}

export async function removeLineItemAction(lineItemId: string): Promise<CartActionResult> {
  const cartId = (await cookies()).get(CART_ID_COOKIE)?.value;
  if (!cartId) return { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ένα νέο.", cart: null };
  return resultFrom(() =>
    medusaFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, { method: "DELETE" })
  );
}

export async function applyPromoCodeAction(code: string): Promise<CartActionResult> {
  const cartId = (await cookies()).get(CART_ID_COOKIE)?.value;
  if (!cartId) return { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ένα νέο.", cart: null };
  return resultFrom(() =>
    medusaFetch(`/store/carts/${cartId}/promotions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promo_codes: [code] }),
    })
  );
}

export async function removePromoCodeAction(code: string): Promise<CartActionResult> {
  const cartId = (await cookies()).get(CART_ID_COOKIE)?.value;
  if (!cartId) return { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ένα νέο.", cart: null };
  return resultFrom(() =>
    medusaFetch(`/store/carts/${cartId}/promotions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promo_codes: [code] }),
    })
  );
}
