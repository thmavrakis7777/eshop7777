import "server-only";
import { sql } from "@/lib/db/client";
import { publicImageUrl } from "@/lib/storage/urls";

/**
 * Read model for the two transactional order emails (confirmation,
 * shipment notification) — shared because both need the same product/
 * pricing/address shape, and shipment notification additionally needs the
 * courier/tracking columns already present on the same row.
 *
 * Deliberately its own query rather than reusing lib/db/orders.ts's Order
 * type: that type is shaped for the storefront confirmation page and
 * account dashboard (no SKU, no per-item image, no payment method) — adding
 * all of this email's fields to it would bloat every other consumer.
 */
export type OrderEmailData = {
  id: string;
  orderNumber: number;
  email: string;
  createdAtFormatted: string;
  items: Array<{
    title: string;
    variantTitle: string | null;
    sku: string | null;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    imageUrl: string | null;
  }>;
  subtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  shippingCents: number;
  shippingMethodName: string | null;
  vatCents: number;
  vatRate: number;
  totalCents: number;
  paymentMethod: string;
  shippingAddress: {
    firstName: string | null;
    lastName: string | null;
    addressLine1: string;
    addressLine2: string | null;
    postalCode: string;
    city: string;
    phone: string | null;
  } | null;
  courierName: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
};

const dateFmt = new Intl.DateTimeFormat("el-GR", { dateStyle: "medium", timeStyle: "short" });

export async function getOrderForEmail(orderId: string): Promise<OrderEmailData | null> {
  const rows = await sql<
    Array<{
      id: string;
      order_number: number;
      email: string;
      created_at: Date;
      subtotal_cents: number;
      discount_cents: number;
      discount_code: string | null;
      shipping_cents: number;
      shipping_method_name: string | null;
      vat_cents: number;
      vat_rate: number;
      total_cents: number;
      payment_method: string;
      shipping_address: Record<string, string | null> | null;
      courier_name: string | null;
      tracking_code: string | null;
      tracking_url: string | null;
      items: Array<{
        title: string;
        variant_title: string | null;
        sku: string | null;
        quantity: number;
        unit_price_cents: number;
        line_total_cents: number;
        image_path: string | null;
      }>;
    }>
  >`
    SELECT o.id, o.order_number, o.email, o.created_at,
           o.subtotal_cents, o.discount_cents, o.discount_code,
           o.shipping_cents, o.shipping_method_name,
           o.vat_cents, o.vat_rate, o.total_cents, o.payment_method,
           o.shipping_address, o.courier_name, o.tracking_code, o.tracking_url,
           COALESCE((
             SELECT json_agg(json_build_object(
               'title', i.title, 'variant_title', i.variant_title, 'sku', i.sku,
               'quantity', i.quantity, 'unit_price_cents', i.unit_price_cents,
               'line_total_cents', i.line_total_cents,
               'image_path', img.storage_path
             ) ORDER BY i.id)
             FROM shop.order_item i
             LEFT JOIN LATERAL (
               SELECT storage_path FROM shop.product_image
                WHERE product_id = i.product_id
                ORDER BY position LIMIT 1
             ) img ON true
             WHERE i.order_id = o.id
           ), '[]'::json) AS items
      FROM shop.orders o
     WHERE o.id = ${orderId}`;

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    orderNumber: r.order_number,
    email: r.email,
    createdAtFormatted: dateFmt.format(new Date(r.created_at)),
    items: r.items.map((i) => ({
      title: i.title,
      variantTitle: i.variant_title,
      sku: i.sku,
      quantity: i.quantity,
      unitPriceCents: i.unit_price_cents,
      lineTotalCents: i.line_total_cents,
      imageUrl: publicImageUrl(i.image_path),
    })),
    subtotalCents: r.subtotal_cents,
    discountCents: r.discount_cents,
    discountCode: r.discount_code,
    shippingCents: r.shipping_cents,
    shippingMethodName: r.shipping_method_name,
    vatCents: r.vat_cents,
    vatRate: Number(r.vat_rate),
    totalCents: r.total_cents,
    paymentMethod: r.payment_method,
    shippingAddress: r.shipping_address
      ? {
          firstName: r.shipping_address.first_name ?? null,
          lastName: r.shipping_address.last_name ?? null,
          addressLine1: r.shipping_address.address_1 ?? "",
          addressLine2: r.shipping_address.address_2 ?? null,
          postalCode: r.shipping_address.postal_code ?? "",
          city: r.shipping_address.city ?? "",
          phone: r.shipping_address.phone ?? null,
        }
      : null,
    courierName: r.courier_name,
    trackingCode: r.tracking_code,
    trackingUrl: r.tracking_url,
  };
}

export async function markConfirmationEmailSent(orderId: string): Promise<void> {
  await sql`UPDATE shop.orders SET confirmation_email_sent_at = now() WHERE id = ${orderId}`;
  await sql`
    INSERT INTO shop.order_event (order_id, type, note)
    VALUES (${orderId}, 'email_confirmation', 'Στάλθηκε email επιβεβαίωσης παραγγελίας')`;
}
