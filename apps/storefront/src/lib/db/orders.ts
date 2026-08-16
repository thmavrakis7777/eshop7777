import "server-only";
import { sql } from "@/lib/db/client";
import { toneFor } from "@/lib/db/catalog";
import { toAddressSummary, type AddressJson } from "@/lib/db/cart";
import type { Order } from "@/lib/types";

/**
 * Order reads. Order *creation* lands in Phase 6 — this is the query side, so
 * the account dashboard and the confirmation page stop depending on Medusa.
 *
 * Medusa spread an order across twelve tables (order, order_item,
 * order_line_item, order_summary, order_shipping, order_change, order_claim,
 * order_exchange, order_transaction, return, credit_line, capture) with
 * totals kept as JSON blobs full of `raw_*` precision wrappers. This is two
 * tables and integer cents.
 */

type OrderRow = {
  id: string;
  order_number: number;
  customer_id: string | null;
  email: string;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  vat_cents: number;
  total_cents: number;
  vat_rate: number;
  shipping_method_name: string | null;
  shipping_address: AddressJson | null;
  billing_address: AddressJson | null;
  tax_document_type: "receipt" | "invoice";
  invoice_company_name: string | null;
  invoice_afm: string | null;
  invoice_doy: string | null;
  invoice_activity: string | null;
  created_at: Date;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    line_total_cents: number;
    product_slug: string | null;
  }>;
};

const eur = (cents: number) => ({ amount: cents / 100, currencyCode: "EUR" as const });

const ORDER_FIELDS = sql`
  o.id, o.order_number, o.customer_id, o.email, o.subtotal_cents, o.discount_cents,
  o.shipping_cents, o.vat_cents, o.total_cents, o.vat_rate,
  o.shipping_method_name, o.shipping_address, o.billing_address,
  o.tax_document_type, o.invoice_company_name, o.invoice_afm,
  o.invoice_doy, o.invoice_activity, o.created_at,
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', i.id, 'title', i.title, 'quantity', i.quantity,
      'line_total_cents', i.line_total_cents, 'product_slug', i.product_slug
    ) ORDER BY i.id)
    FROM shop.order_item i WHERE i.order_id = o.id
  ), '[]'::json) AS items`;

export function toDomainOrder(o: OrderRow): Order {
  return {
    id: o.id,
    displayId: o.order_number,
    email: o.email,
    items: o.items.map((item) => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      total: eur(item.line_total_cents),
      // Tone keys off the product slug where the line still has one, so a
      // placeholder tile keeps the same colour it had on the product page.
      placeholderTone: toneFor(item.product_slug ?? item.title),
    })),
    subtotal: eur(o.subtotal_cents),
    discountTotal: eur(o.discount_cents),
    shippingTotal: eur(o.shipping_cents),
    vatTotal: eur(o.vat_cents),
    vatRate: Number(o.vat_rate),
    total: eur(o.total_cents),
    shippingMethodName: o.shipping_method_name ?? undefined,
    shippingAddress: o.shipping_address ? toAddressSummary(o.shipping_address) : undefined,
    billingAddress: o.billing_address ? toAddressSummary(o.billing_address) : undefined,
    taxDocumentType: o.tax_document_type,
    ...(o.tax_document_type === "invoice" && (o.invoice_company_name || o.invoice_afm)
      ? {
          invoiceDetails: {
            companyName: o.invoice_company_name ?? "",
            afm: o.invoice_afm ?? "",
            doy: o.invoice_doy ?? "",
            activity: o.invoice_activity ?? "",
          },
        }
      : {}),
    createdAt: new Date(o.created_at).toISOString(),
  };
}

/**
 * Order lookup by id — shared by the guest confirmation page and (reusing
 * the same page/query) the logged-in customer's own order-detail view.
 *
 * The uuid is the de facto access token for a *guest* order (customer_id
 * null) — the same trust model as most hosted-checkout "thank you" pages,
 * and unguessable at 122 bits of entropy. An order placed by a logged-in
 * customer is not covered by that model: it stays reachable indefinitely
 * (no expiry) from browser history, a copied link, etc., and carries more
 * complete PII (full address, ΑΦΜ) tied to a real identified account. So for
 * a customer-owned order, the uuid alone is not enough — the caller's own
 * session must belong to that same customer, or this returns null exactly
 * as if the order didn't exist (never leaks whether a mismatched id is
 * "wrong customer" vs. "no such order").
 */
export async function getOrderById(orderId: string, viewerCustomerId: string | null = null): Promise<Order | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  try {
    const rows = await sql<OrderRow[]>`
      SELECT ${ORDER_FIELDS} FROM shop.orders o WHERE o.id = ${orderId} LIMIT 1`;
    const row = rows[0];
    if (!row) return null;
    if (row.customer_id && row.customer_id !== viewerCustomerId) return null;
    return toDomainOrder(row);
  } catch {
    return null;
  }
}

export async function listCustomerOrders(customerId: string): Promise<Order[]> {
  const rows = await sql<OrderRow[]>`
    SELECT ${ORDER_FIELDS} FROM shop.orders o
     WHERE o.customer_id = ${customerId}
     ORDER BY o.created_at DESC`;
  return rows.map(toDomainOrder);
}
