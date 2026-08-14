"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { medusaFetch, MedusaApiError, type MedusaCart, type MedusaCartCompleteResponse } from "@/lib/medusa";
import { CART_ID_COOKIE, getCart } from "@/lib/data/cart";
import { getPaymentProviders, getShippingOptionsForCart } from "@/lib/data/checkout";
import type { Cart, ShippingOption } from "@/lib/types";

// Maps Medusa's real error shapes (verified live where possible — see
// CHECKOUT_UX_SPEC.md for exactly what was and wasn't force-triggered) to
// the Greek copy table in CHECKOUT_UX_SPEC.md §12. Never let a raw Medusa/
// HTTP message reach a customer — same rule as lib/actions/cart.ts.
function mapCheckoutError(err: unknown): string {
  if (err instanceof MedusaApiError) {
    if (err.code === "insufficient_inventory") {
      return "Ένα προϊόν στο καλάθι σου δεν είναι πλέον διαθέσιμο στην ποσότητα που ζήτησες.";
    }
    if (err.type === "invalid_data") {
      return "Έλεγξε τα στοιχεία που συμπλήρωσες — κάτι δεν είναι έγκυρο.";
    }
    if (err.status === 404) {
      return "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι.";
    }
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}

async function requireCartId(): Promise<string | null> {
  return (await cookies()).get(CART_ID_COOKIE)?.value ?? null;
}

export type CheckoutActionResult = { ok: true; cart: Cart } | { ok: false; error: string; cart: Cart | null };

export async function updateCheckoutEmailAction(email: string): Promise<CheckoutActionResult> {
  const cartId = await requireCartId();
  if (!cartId) return { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι.", cart: null };

  try {
    await medusaFetch<{ cart: MedusaCart }>(`/store/carts/${cartId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    revalidatePath("/checkout");
    const cart = await getCart();
    return cart ? { ok: true, cart } : { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι.", cart: null };
  } catch (err) {
    return { ok: false, error: mapCheckoutError(err), cart: await getCart() };
  }
}

export type CheckoutDetails = {
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  number: string;
  area?: string;
  postalCode: string;
  city: string;
  billingDiffers: boolean;
  billing?: { street: string; number: string; area?: string; postalCode: string; city: string };
};

export type CheckoutDetailsResult =
  | { ok: true; cart: Cart; shippingOptions: ShippingOption[] }
  | { ok: false; error: string; cart: Cart | null };

// One combined write for both visual sections ("Στοιχεία παραλήπτη" +
// "Διεύθυνση παράδοσης") — they're both just Medusa's single
// `shipping_address` object (there's no separate "customer info" field on
// a cart), so splitting this into two Server Actions would just be two
// partial writes to the same object for no benefit. Country is always
// "gr" — not a form field — per the approved checkout spec (the region's
// 8-country list is a backend leftover from the demo seed, not a real
// serviceable market list; see CHECKOUT_UX_SPEC.md §6).
export async function updateCheckoutDetailsAction(details: CheckoutDetails): Promise<CheckoutDetailsResult> {
  const cartId = await requireCartId();
  if (!cartId) return { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι.", cart: null };

  const shippingAddress = {
    first_name: details.firstName,
    last_name: details.lastName,
    phone: details.phone,
    address_1: `${details.street} ${details.number}`.trim(),
    address_2: details.area || undefined,
    postal_code: details.postalCode,
    city: details.city,
    country_code: "gr",
  };
  const billingAddress =
    details.billingDiffers && details.billing
      ? {
          first_name: details.firstName,
          last_name: details.lastName,
          phone: details.phone,
          address_1: `${details.billing.street} ${details.billing.number}`.trim(),
          address_2: details.billing.area || undefined,
          postal_code: details.billing.postalCode,
          city: details.billing.city,
          country_code: "gr",
        }
      : shippingAddress;

  try {
    await medusaFetch<{ cart: MedusaCart }>(`/store/carts/${cartId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipping_address: shippingAddress, billing_address: billingAddress }),
    });

    const [cart, shippingOptions] = await Promise.all([getCart(), getShippingOptionsForCart(cartId)]);
    revalidatePath("/checkout");
    return cart
      ? { ok: true, cart, shippingOptions }
      : { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι.", cart: null };
  } catch (err) {
    return { ok: false, error: mapCheckoutError(err), cart: await getCart() };
  }
}

export type TaxDocumentDetails =
  | { type: "receipt" }
  | { type: "invoice"; companyName: string; afm: string; doy: string; activity: string };

// Stored in cart.metadata (no native Medusa field for this — see
// lib/data/cart.ts's parseTaxDocumentMetadata for the read side). Confirmed
// live: unlike the fulfillment service zone's geo_zones (a real full-
// replace endpoint, see PROJECT_MEMORY.md), a cart metadata POST *merges*
// into the existing object — an omitted key is left untouched, not cleared.
// That means switching back to "receipt" must send the invoice_* keys as
// explicit `null` to actually clear them; `undefined` doesn't work, because
// `JSON.stringify` drops `undefined` properties entirely, so the key never
// reaches Medusa at all and the stale value silently survives — confirmed
// live as a real bug in an earlier version of this function.
export async function updateTaxDocumentAction(details: TaxDocumentDetails): Promise<CheckoutActionResult> {
  const cartId = await requireCartId();
  if (!cartId) return { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι.", cart: null };

  try {
    const { cart: currentCart } = await medusaFetch<{ cart: MedusaCart }>(`/store/carts/${cartId}?fields=metadata`, {
      cache: "no-store",
    });

    const existingMetadata = currentCart.metadata ?? {};
    const metadata =
      details.type === "invoice"
        ? {
            ...existingMetadata,
            tax_document_type: "invoice",
            invoice_company_name: details.companyName,
            invoice_afm: details.afm,
            invoice_doy: details.doy,
            invoice_activity: details.activity,
          }
        : {
            ...existingMetadata,
            tax_document_type: "receipt",
            invoice_company_name: null,
            invoice_afm: null,
            invoice_doy: null,
            invoice_activity: null,
          };

    await medusaFetch<{ cart: MedusaCart }>(`/store/carts/${cartId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata }),
    });

    revalidatePath("/checkout");
    const cart = await getCart();
    return cart ? { ok: true, cart } : { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι.", cart: null };
  } catch (err) {
    return { ok: false, error: mapCheckoutError(err), cart: await getCart() };
  }
}

export async function setShippingMethodAction(optionId: string): Promise<CheckoutActionResult> {
  const cartId = await requireCartId();
  if (!cartId) return { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι.", cart: null };

  try {
    await medusaFetch<{ cart: MedusaCart }>(`/store/carts/${cartId}/shipping-methods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: optionId }),
    });
    revalidatePath("/checkout");
    const cart = await getCart();
    return cart ? { ok: true, cart } : { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι.", cart: null };
  } catch {
    return {
      ok: false,
      error: "Δεν είναι διαθέσιμη αυτή η μέθοδος αποστολής. Δοκίμασε ξανά.",
      cart: await getCart(),
    };
  }
}

export type CheckoutCompleteResult =
  | { ok: true; orderId: string; displayId: number }
  | { ok: false; error: string };

// The real end-to-end flow, verified live before this was written (see
// CHECKOUT_UX_SPEC.md): create a payment collection for the cart, open a
// payment session against whatever provider is actually configured (today,
// exactly one — never hardcoded here), then complete the cart.
// `/store/carts/:id/complete` returns a discriminated union — success comes
// back as `{ type: "order", order }` directly in the response, not as a
// side effect to re-fetch; a workflow-level failure (e.g. stock vanished
// between checkout and submission) comes back as `{ type: "cart", cart,
// error }` with a 200, not a thrown HTTP error — confirmed the success
// path live, coded the failure branch defensively per Medusa's documented
// contract since it wasn't practical to force-trigger without deliberately
// corrupting stock data.
export async function completeCheckoutAction(): Promise<CheckoutCompleteResult> {
  const cartId = await requireCartId();
  if (!cartId) return { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι." };

  try {
    const cart = await getCart();
    if (!cart) return { ok: false, error: "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι." };
    if (!cart.email || !cart.shippingAddress || !cart.hasShippingMethod) {
      return { ok: false, error: "Συμπλήρωσε όλα τα απαραίτητα στοιχεία πριν ολοκληρώσεις την παραγγελία." };
    }

    const providers = await getPaymentProviders();
    const providerId = providers[0]?.id;
    if (!providerId) {
      return { ok: false, error: "Δεν υπάρχει διαθέσιμος τρόπος πληρωμής αυτή τη στιγμή. Επικοινώνησε μαζί μας." };
    }

    const { payment_collection } = await medusaFetch<{ payment_collection: { id: string } }>(
      "/store/payment-collections",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart_id: cartId }),
      }
    );

    await medusaFetch(`/store/payment-collections/${payment_collection.id}/payment-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: providerId }),
    });

    const result = await medusaFetch<MedusaCartCompleteResponse>(`/store/carts/${cartId}/complete`, {
      method: "POST",
    });

    if (result.type === "order") {
      (await cookies()).delete(CART_ID_COOKIE);
      revalidatePath("/", "layout");
      return { ok: true, orderId: result.order.id, displayId: result.order.display_id };
    }

    const failureMessage = result.error?.message ?? "";
    const stockRelated = /inventory|stock/i.test(failureMessage);
    return {
      ok: false,
      error: stockRelated
        ? "Ένα προϊόν στο καλάθι σου δεν είναι πλέον διαθέσιμο. Επίστρεψε στο καλάθι για να το αφαιρέσεις."
        : "Κάτι πήγε στραβά. Δοκίμασε ξανά.",
    };
  } catch (err) {
    return { ok: false, error: mapCheckoutError(err) };
  }
}
