import "server-only";
import { sql, transaction } from "@/lib/db/client";

/**
 * Order management for the admin.
 *
 * Orders are the one place where an admin mistake costs real money, so the
 * write side is narrow on purpose: status transitions and notes, nothing
 * that silently rewrites what the customer was charged. Editing line items
 * or totals after the fact is not offered, because an order is a record of
 * an agreement, not a draft.
 */

export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "refunded" | "partially_refunded";
export type FulfillmentStatus = "unfulfilled" | "fulfilled" | "partially_fulfilled" | "returned";

export class OrderError extends Error {
  constructor(message: string, public readonly code: "not_found" | "already_cancelled" | "invalid_transition") {
    super(message);
  }
}

export type AdminOrderRow = {
  id: string;
  orderNumber: number;
  email: string;
  customerName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  totalCents: number;
  itemCount: number;
  createdAt: string;
};

export type OrderFilters = {
  q?: string;
  status?: OrderStatus | "all";
  paymentStatus?: PaymentStatus | "all";
  page?: number;
  perPage?: number;
};

export async function listOrders(filters: OrderFilters = {}): Promise<{
  orders: AdminOrderRow[];
  total: number;
  page: number;
  perPage: number;
}> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(10, filters.perPage ?? 25));
  const offset = (page - 1) * perPage;
  const q = filters.q?.trim();
  // A bare number is almost always an order number, not a search term.
  const asNumber = q && /^\d+$/.test(q) ? Number(q) : null;

  const rows = (await sql`
    SELECT o.id, o.order_number, o.email, o.status, o.payment_status,
           o.fulfillment_status, o.total_cents, o.created_at,
           COALESCE(o.shipping_address->>'first_name', '') || ' ' ||
           COALESCE(o.shipping_address->>'last_name', '') AS customer_name,
           (SELECT COALESCE(SUM(i.quantity), 0) FROM shop.order_item i WHERE i.order_id = o.id)::int AS item_count,
           COUNT(*) OVER () AS total_count
      FROM shop.orders o
     WHERE TRUE
       ${filters.status && filters.status !== "all" ? sql`AND o.status = ${filters.status}` : sql``}
       ${filters.paymentStatus && filters.paymentStatus !== "all"
         ? sql`AND o.payment_status = ${filters.paymentStatus}`
         : sql``}
       ${q
         ? asNumber != null
           ? sql`AND o.order_number = ${asNumber}`
           : sql`AND (o.email ILIKE ${"%" + q + "%"}
                      OR o.shipping_address->>'last_name' ILIKE ${"%" + q + "%"}
                      OR o.shipping_address->>'first_name' ILIKE ${"%" + q + "%"})`
         : sql``}
     ORDER BY o.created_at DESC
     LIMIT ${perPage} OFFSET ${offset}`) as unknown as Array<{
    id: string; order_number: number; email: string; status: OrderStatus;
    payment_status: PaymentStatus; fulfillment_status: FulfillmentStatus;
    total_cents: number; created_at: Date; customer_name: string;
    item_count: number; total_count: string;
  }>;

  return {
    orders: rows.map((r) => ({
      id: r.id,
      orderNumber: r.order_number,
      email: r.email,
      customerName: r.customer_name.trim(),
      status: r.status,
      paymentStatus: r.payment_status,
      fulfillmentStatus: r.fulfillment_status,
      totalCents: r.total_cents,
      itemCount: r.item_count,
      createdAt: new Date(r.created_at).toISOString(),
    })),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    perPage,
  };
}

export type AdminOrderDetail = {
  id: string;
  orderNumber: number;
  email: string;
  phone: string | null;
  customerId: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  vatCents: number;
  totalCents: number;
  vatRate: number;
  shippingAddress: Record<string, string | null> | null;
  billingAddress: Record<string, string | null> | null;
  shippingMethodName: string | null;
  paymentMethod: string;
  discountCode: string | null;
  taxDocumentType: "receipt" | "invoice";
  invoiceCompanyName: string | null;
  invoiceAfm: string | null;
  invoiceDoy: string | null;
  invoiceActivity: string | null;
  customerNote: string | null;
  adminNote: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string | null;
    title: string;
    variantTitle: string | null;
    sku: string | null;
    productSlug: string | null;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
  events: Array<{ id: string; type: string; fromStatus: string | null; toStatus: string | null; note: string | null; createdAt: string; adminName: string | null }>;
};

export async function getOrderDetail(id: string): Promise<AdminOrderDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const rows = (await sql`
    SELECT o.*,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', i.id, 'productId', i.product_id, 'title', i.title,
          'variantTitle', i.variant_title, 'sku', i.sku, 'productSlug', i.product_slug,
          'quantity', i.quantity, 'unitPriceCents', i.unit_price_cents,
          'lineTotalCents', i.line_total_cents) ORDER BY i.id)
        FROM shop.order_item i WHERE i.order_id = o.id), '[]'::json) AS items,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', e.id, 'type', e.type, 'fromStatus', e.from_status, 'toStatus', e.to_status,
          'note', e.note, 'createdAt', e.created_at, 'adminName', u.name) ORDER BY e.created_at DESC)
        FROM shop.order_event e
        LEFT JOIN shop.admin_user u ON u.id = e.admin_user_id
        WHERE e.order_id = o.id), '[]'::json) AS events
    FROM shop.orders o WHERE o.id = ${id}`) as unknown as Array<Record<string, unknown>>;

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id as string,
    orderNumber: r.order_number as number,
    email: r.email as string,
    phone: (r.phone as string) ?? null,
    customerId: (r.customer_id as string) ?? null,
    status: r.status as OrderStatus,
    paymentStatus: r.payment_status as PaymentStatus,
    fulfillmentStatus: r.fulfillment_status as FulfillmentStatus,
    subtotalCents: r.subtotal_cents as number,
    discountCents: r.discount_cents as number,
    shippingCents: r.shipping_cents as number,
    vatCents: r.vat_cents as number,
    totalCents: r.total_cents as number,
    vatRate: Number(r.vat_rate),
    shippingAddress: (r.shipping_address as Record<string, string | null>) ?? null,
    billingAddress: (r.billing_address as Record<string, string | null>) ?? null,
    shippingMethodName: (r.shipping_method_name as string) ?? null,
    paymentMethod: r.payment_method as string,
    discountCode: (r.discount_code as string) ?? null,
    taxDocumentType: r.tax_document_type as "receipt" | "invoice",
    invoiceCompanyName: (r.invoice_company_name as string) ?? null,
    invoiceAfm: (r.invoice_afm as string) ?? null,
    invoiceDoy: (r.invoice_doy as string) ?? null,
    invoiceActivity: (r.invoice_activity as string) ?? null,
    customerNote: (r.customer_note as string) ?? null,
    adminNote: (r.admin_note as string) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
    items: r.items as AdminOrderDetail["items"],
    events: (r.events as AdminOrderDetail["events"]).map((e) => ({
      ...e,
      createdAt: new Date(e.createdAt).toISOString(),
    })),
  };
}

/**
 * Valid forward transitions. Not a rigid workflow engine — an operator can
 * skip ahead (pending straight to shipped) because real shops do — but an
 * order cannot leave a terminal state, which is what stops a delivered or
 * cancelled order being quietly reopened.
 */
const TERMINAL: OrderStatus[] = ["cancelled"];

export async function updateOrderStatus(
  orderId: string,
  next: OrderStatus,
  adminUserId: string,
  note?: string
): Promise<void> {
  await transaction(async (tx) => {
    const [order] = await tx<{ status: OrderStatus }[]>`
      SELECT status FROM shop.orders WHERE id = ${orderId} FOR UPDATE`;
    if (!order) throw new OrderError("Order not found", "not_found");
    if (order.status === next) return;
    if (TERMINAL.includes(order.status)) {
      throw new OrderError("Cancelled orders cannot change status", "invalid_transition");
    }

    // Cancelling returns the reserved units to stock. Doing this anywhere
    // other than inside the same transaction as the status change would
    // allow a cancelled order whose stock was never returned.
    if (next === "cancelled") {
      const items = await tx<{ variant_id: string | null; quantity: number }[]>`
        SELECT variant_id, quantity FROM shop.order_item WHERE order_id = ${orderId}`;
      for (const item of items) {
        if (!item.variant_id) continue; // product deleted since — nothing to restore
        await tx`
          UPDATE shop.product_variant
             SET stock_quantity = stock_quantity + ${item.quantity}
           WHERE id = ${item.variant_id}`;
        await tx`
          INSERT INTO shop.inventory_movement (variant_id, delta, reason, order_id, admin_user_id, note)
          VALUES (${item.variant_id}, ${item.quantity}, 'cancel', ${orderId}, ${adminUserId},
                  'Επιστροφή αποθέματος από ακύρωση')`;
      }
    }

    await tx`UPDATE shop.orders SET status = ${next} WHERE id = ${orderId}`;
    await tx`
      INSERT INTO shop.order_event (order_id, type, from_status, to_status, note, admin_user_id)
      VALUES (${orderId}, 'status', ${order.status}, ${next}, ${note ?? null}, ${adminUserId})`;
  });
}

export async function updatePaymentStatus(
  orderId: string,
  next: PaymentStatus,
  adminUserId: string
): Promise<void> {
  await transaction(async (tx) => {
    const [order] = await tx<{ payment_status: PaymentStatus }[]>`
      SELECT payment_status FROM shop.orders WHERE id = ${orderId} FOR UPDATE`;
    if (!order) throw new OrderError("Order not found", "not_found");
    if (order.payment_status === next) return;

    await tx`UPDATE shop.orders SET payment_status = ${next} WHERE id = ${orderId}`;
    await tx`
      INSERT INTO shop.order_event (order_id, type, from_status, to_status, admin_user_id)
      VALUES (${orderId}, 'payment', ${order.payment_status}, ${next}, ${adminUserId})`;
  });
}

export async function updateFulfillmentStatus(
  orderId: string,
  next: FulfillmentStatus,
  adminUserId: string
): Promise<void> {
  await transaction(async (tx) => {
    const [order] = await tx<{ fulfillment_status: FulfillmentStatus }[]>`
      SELECT fulfillment_status FROM shop.orders WHERE id = ${orderId} FOR UPDATE`;
    if (!order) throw new OrderError("Order not found", "not_found");
    if (order.fulfillment_status === next) return;

    await tx`UPDATE shop.orders SET fulfillment_status = ${next} WHERE id = ${orderId}`;
    await tx`
      INSERT INTO shop.order_event (order_id, type, from_status, to_status, admin_user_id)
      VALUES (${orderId}, 'fulfillment', ${order.fulfillment_status}, ${next}, ${adminUserId})`;
  });
}

export async function saveAdminNote(orderId: string, note: string | null): Promise<void> {
  await sql`UPDATE shop.orders SET admin_note = ${note} WHERE id = ${orderId}`;
}
