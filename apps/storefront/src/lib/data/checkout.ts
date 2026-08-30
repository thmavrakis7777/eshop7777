import { sql } from "@/lib/db/client";
import { getOrderById } from "@/lib/db/orders";
import { isHeraklionAddress } from "@/lib/heraklion";
import type { Order, PaymentProvider, ShippingOption } from "@/lib/types";

export { getNationwideFreeShippingThresholdCents } from "@/lib/db/content";

// Delivery estimates are storefront copy keyed off the method name, not data
// the shipping table carries — a promise about lead time belongs with the
// people who can honour it. Unknown names show no estimate rather than a guess.
const DELIVERY_ESTIMATES: Record<string, string> = {
  "Standard Shipping": "Παράδοση σε 2-3 εργάσιμες",
  "Express Shipping": "Παράδοση εντός 24 ωρών",
};

/**
 * Shipping options. Under Medusa these were resolved per-cart against
 * fulfillment service zones — real machinery for a store that ships to one
 * country with three flat-rate options. They are rows in
 * shop.shipping_method now.
 *
 * Address-dependent since the Heraklion rule: a heraklion_only row is only
 * ever included when the cart's own saved shipping address genuinely
 * resolves to Heraklion (src/lib/heraklion.ts) — read from the cart itself,
 * not trusted from a caller-supplied argument, since this list is what the
 * checkout radio buttons are built from. Pickup is location-independent and
 * always included. A cart with no address yet, or an address outside
 * Heraklion, sees exactly the pre-existing nationwide list.
 */
export async function getShippingOptionsForCart(cartId?: string): Promise<ShippingOption[]> {
  let isHeraklion = false;
  if (cartId) {
    const [cart] = await sql<{ shipping_address: { city?: string | null; postal_code?: string | null } | null }[]>`
      SELECT shipping_address FROM shop.cart WHERE id = ${cartId}`;
    isHeraklion = isHeraklionAddress(cart?.shipping_address ?? null);
  }

  const rows = await sql<
    { id: string; name: string; price_cents: number; free_over_cents: number | null; is_pickup: boolean }[]
  >`SELECT id, name, price_cents, free_over_cents, is_pickup
      FROM shop.shipping_method
     WHERE is_active AND (is_pickup OR heraklion_only = ${isHeraklion})
     ORDER BY sort_order, name`;

  return rows.map((o) => ({
    id: o.id,
    name: o.name,
    price: { amount: o.price_cents / 100, currencyCode: "EUR" },
    deliveryEstimate: DELIVERY_ESTIMATES[o.name],
    isPickup: o.is_pickup,
    freeOverCents: o.free_over_cents,
  }));
}

/**
 * Payment methods — admin-configurable (Settings → Πληρωμές), never
 * hardcoded at the call site. Only methods that are both real, implemented
 * flows AND switched on by the owner ever reach checkout; card payment (no
 * processor integration exists) has no row to switch on in the first place.
 */
export async function getPaymentProviders(): Promise<PaymentProvider[]> {
  const rows = await sql<
    { code: string; name: string; description: string | null }[]
  >`SELECT code, name, description FROM shop.payment_method WHERE is_active ORDER BY sort_order, name`;
  return rows.map((r) => ({ id: r.code, name: r.name, description: r.description }));
}

/**
 * Order lookup for the confirmation page / account order-detail view.
 * `viewerCustomerId` (the current session's customer, if any) is required
 * for a customer-owned order to be returned at all — see getOrderById.
 */
export async function getOrder(orderId: string, viewerCustomerId: string | null = null): Promise<Order | null> {
  return getOrderById(orderId, viewerCustomerId);
}
