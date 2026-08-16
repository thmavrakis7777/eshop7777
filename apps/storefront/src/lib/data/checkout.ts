import { sql } from "@/lib/db/client";
import { getOrderById } from "@/lib/db/orders";
import type { Order, PaymentProvider, ShippingOption } from "@/lib/types";

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
 * The signature keeps a cart argument because checkout calls it that way and
 * Phase 6 may add address-dependent rules (islands, remote postcodes), at
 * which point the cart is exactly what it will need.
 */
export async function getShippingOptionsForCart(_cartId?: string): Promise<ShippingOption[]> {
  const rows = await sql<
    { id: string; name: string; price_cents: number; is_pickup: boolean }[]
  >`SELECT id, name, price_cents, is_pickup
      FROM shop.shipping_method WHERE is_active ORDER BY sort_order, name`;

  return rows.map((o) => ({
    id: o.id,
    name: o.name,
    price: { amount: o.price_cents / 100, currencyCode: "EUR" },
    deliveryEstimate: DELIVERY_ESTIMATES[o.name],
    isPickup: o.is_pickup,
  }));
}

/**
 * Payment methods. Exactly one exists — cash on delivery (Αντικαταβολή) —
 * and Medusa's payment-collection/payment-session ceremony around it bought
 * nothing. Still a list, never hardcoded at the call site, so a real card
 * processor is one entry rather than a refactor.
 */
export async function getPaymentProviders(): Promise<PaymentProvider[]> {
  return [{ id: "cod" }];
}

/**
 * Order lookup for the confirmation page / account order-detail view.
 * `viewerCustomerId` (the current session's customer, if any) is required
 * for a customer-owned order to be returned at all — see getOrderById.
 */
export async function getOrder(orderId: string, viewerCustomerId: string | null = null): Promise<Order | null> {
  return getOrderById(orderId, viewerCustomerId);
}
