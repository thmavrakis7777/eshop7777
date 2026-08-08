import { medusaFetch, MedusaApiError, type MedusaOrder, type MedusaPaymentProvider, type MedusaShippingOption } from "@/lib/medusa";
import { toAddressSummary } from "@/lib/data/cart";
import { toneFor } from "@/lib/data/products";
import type { Order, PaymentProvider, ShippingOption } from "@/lib/types";

// Real backend content ("standard"/"express" codes), just only available in
// English at the source (`type.description`, e.g. "Ship in 2-3 days.") —
// translating a known, stable code is not the same as inventing a claim the
// data doesn't back. Unrecognized codes fall back to no estimate shown
// rather than a guess.
const DELIVERY_ESTIMATES: Record<string, string> = {
  standard: "Παράδοση σε 2-3 εργάσιμες",
  express: "Παράδοση εντός 24 ωρών",
};

// Shipping options are scoped to a specific cart (Medusa resolves them
// against that cart's shipping address + fulfillment service zones) — see
// PROJECT_MEMORY.md "Cart architecture" for the real fulfillment-service-zone
// gotcha found while verifying this endpoint. Empty array (not an error) is
// a legitimate real state: no shipping is available for this address yet.
export async function getShippingOptionsForCart(cartId: string): Promise<ShippingOption[]> {
  const { shipping_options } = await medusaFetch<{ shipping_options: MedusaShippingOption[] }>(
    `/store/shipping-options?cart_id=${cartId}&fields=id,name,amount,*type`,
    { cache: "no-store" }
  );
  return shipping_options.map((o) => ({
    id: o.id,
    name: o.name,
    price: { amount: o.amount, currencyCode: "EUR" },
    deliveryEstimate: o.type?.code ? DELIVERY_ESTIMATES[o.type.code] : undefined,
  }));
}

// Confirmed live (CHECKOUT_UX_SPEC.md §0.3): exactly one provider exists
// today, `pp_system_default` — presented to the customer as "Αντικαταβολή"
// by the payment UI, not renamed here. Never hardcoded: a real processor
// added later just appears as another entry.
export async function getPaymentProviders(regionId: string): Promise<PaymentProvider[]> {
  const { payment_providers } = await medusaFetch<{ payment_providers: MedusaPaymentProvider[] }>(
    `/store/payment-providers?region_id=${regionId}`,
    { next: { revalidate: 300 } }
  );
  return payment_providers.filter((p) => p.is_enabled).map((p) => ({ id: p.id }));
}

// Guest order lookup by ID — confirmed live to work with just the
// publishable key, no customer session required (Medusa's default guest-
// order behavior in this setup). The order ID itself (a long ULID) is the
// de facto access token for the confirmation page, the same trust model
// used by most hosted-checkout "thank you" pages.
export async function getOrder(orderId: string): Promise<Order | null> {
  try {
    const { order } = await medusaFetch<{ order: MedusaOrder }>(
      `/store/orders/${orderId}` +
        "?fields=id,display_id,email,total,item_subtotal,discount_total,shipping_total,created_at," +
        "*items,*shipping_address,*shipping_methods",
      { cache: "no-store" }
    );
    return toDomainOrder(order);
  } catch (err) {
    if (err instanceof MedusaApiError && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
}

function toDomainOrder(o: MedusaOrder): Order {
  return {
    id: o.id,
    displayId: o.display_id,
    email: o.email ?? "",
    items: o.items.map((item) => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      total: { amount: item.total, currencyCode: "EUR" },
      placeholderTone: toneFor(item.title),
    })),
    subtotal: { amount: o.item_subtotal, currencyCode: "EUR" },
    discountTotal: { amount: o.discount_total, currencyCode: "EUR" },
    shippingTotal: { amount: o.shipping_total, currencyCode: "EUR" },
    total: { amount: o.total, currencyCode: "EUR" },
    shippingMethodName: o.shipping_methods[0]?.name,
    shippingAddress: o.shipping_address ? toAddressSummary(o.shipping_address) : undefined,
    createdAt: o.created_at,
  };
}
