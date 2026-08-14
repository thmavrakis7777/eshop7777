import { medusaFetch, MedusaApiError, type MedusaOrder } from "@/lib/medusa";
import { sql } from "@/lib/db/client";
import { toAddressSummary } from "@/lib/db/cart";
import { toneFor } from "@/lib/data/products";
import type { Order, PaymentProvider, ShippingOption, TaxDocumentType, InvoiceDetails } from "@/lib/types";

// Delivery estimates are storefront copy keyed off the method name, not data
// the shipping table carries — a promise about lead time belongs with the
// people who can honour it. Unknown names show no estimate rather than a guess.
const DELIVERY_ESTIMATES: Record<string, string> = {
  "Standard Shipping": "Παράδοση σε 2-3 εργάσιμες",
  "Express Shipping": "Παράδοση εντός 24 ωρών",
};

/**
 * Shipping options. Under Medusa these were resolved per-cart against
 * fulfillment service zones — real complexity for a store that ships to one
 * country with three flat-rate options. They are now rows in
 * shop.shipping_method, so the cart id is no longer part of the question.
 *
 * The signature keeps its cart argument because checkout still calls it that
 * way and Phase 6 may reintroduce address-dependent rules (islands, remote
 * postcodes) — at which point the cart is exactly what it will need.
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
 * nothing. Still returned as a list, never hardcoded at the call site, so a
 * real card processor is one row rather than a refactor.
 */
export async function getPaymentProviders(): Promise<PaymentProvider[]> {
  return [{ id: "cod" }];
}

// ---------------------------------------------------------------------------
// Orders — still read from Medusa until Phase 6 moves order creation over.
// Everything below this line is scheduled for deletion in that phase.
// ---------------------------------------------------------------------------

// Medusa has no field for Greek tax-document details, so they were stored in
// `order.metadata`. Kept here (rather than shared) precisely because it is
// Medusa-shaped and dies with the rest of this section.
function parseMedusaTaxDocument(
  metadata: Record<string, unknown> | null
): { taxDocumentType: TaxDocumentType; invoiceDetails?: InvoiceDetails } {
  const type = metadata?.tax_document_type === "invoice" ? "invoice" : "receipt";
  if (type !== "invoice") return { taxDocumentType: "receipt" };

  const companyName = typeof metadata?.invoice_company_name === "string" ? metadata.invoice_company_name : "";
  const afm = typeof metadata?.invoice_afm === "string" ? metadata.invoice_afm : "";
  const doy = typeof metadata?.invoice_doy === "string" ? metadata.invoice_doy : "";
  const activity = typeof metadata?.invoice_activity === "string" ? metadata.invoice_activity : "";
  if (!companyName && !afm) return { taxDocumentType: "receipt" };

  return { taxDocumentType: "invoice", invoiceDetails: { companyName, afm, doy, activity } };
}

export async function getOrder(orderId: string): Promise<Order | null> {
  try {
    const { order } = await medusaFetch<{ order: MedusaOrder }>(
      `/store/orders/${orderId}` +
        "?fields=id,display_id,email,total,item_subtotal,discount_total,shipping_total,created_at,metadata," +
        "*items,*shipping_address,*billing_address,*shipping_methods",
      { cache: "no-store" }
    );
    return toDomainOrder(order);
  } catch (err) {
    if (err instanceof MedusaApiError && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
}

export function toDomainOrder(o: MedusaOrder): Order {
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
    billingAddress: o.billing_address ? toAddressSummary(o.billing_address) : undefined,
    ...parseMedusaTaxDocument(o.metadata),
    createdAt: o.created_at,
  };
}
