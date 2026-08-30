import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db/client";
import { computeTotals } from "@/lib/db/cart";
import { isHeraklionAddress } from "@/lib/heraklion";
import {
  LOYALTY_REWARD_DEFAULT_EXPIRY_DAYS,
  LOYALTY_REWARD_THRESHOLD_CENTS,
  LOYALTY_REWARD_VALUE_CENTS,
} from "@/lib/loyalty";

/**
 * Order completion — the single most correctness-critical function in this
 * codebase, and the one thing Medusa gave us for free.
 *
 * Everything happens inside ONE transaction. The failure this design exists
 * to prevent is overselling: two people checking out the last unit at the
 * same time must not both succeed. That is handled by making the stock
 * decrement itself the concurrency check (see decrementStock below) rather
 * than reading stock and then writing it, which always races.
 *
 * The cart row is locked FOR UPDATE first, so a double-clicked "place order"
 * serialises instead of creating two orders from one cart.
 *
 * The confirmation email is sent by the CALLER, after commit. An email
 * provider outage must never roll back an order the customer has placed.
 */

export class CheckoutError extends Error {
  constructor(message: string, public readonly code: CheckoutErrorCode) {
    super(message);
  }
}
export type CheckoutErrorCode =
  | "empty_cart"
  | "missing_details"
  | "insufficient_inventory"
  | "already_completed"
  | "not_found";

export type CompletedOrder = {
  id: string;
  orderNumber: number;
  email: string;
  totalCents: number;
  items: Array<{ title: string; quantity: number; lineTotalCents: number }>;
  loyaltyReward: { code: string; endsAt: string | null } | null;
};

// No 0/O/1/I — avoids a code that reads ambiguously when handwritten or
// read aloud (a real support-ticket source for the admin-created codes this
// reuses the same table as).
const LOYALTY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomLoyaltyCode(): string {
  const bytes = randomBytes(6);
  let suffix = "";
  for (const b of bytes) suffix += LOYALTY_CODE_ALPHABET[b % LOYALTY_CODE_ALPHABET.length];
  return `LOYAL-${suffix}`;
}

export async function completeOrder(
  cartId: string,
  customerId: string | null,
  paymentMethodCode: string
): Promise<CompletedOrder> {
  return sql.begin(async (tx) => {
    // FOR UPDATE: serialises concurrent submissions of the same cart. A
    // double-click produces one order and one "already completed" error,
    // never two orders.
    const [cart] = await tx<
      {
        id: string;
        status: string;
        email: string | null;
        customer_id: string | null;
        shipping_address: Record<string, unknown> | null;
        billing_address: Record<string, unknown> | null;
        shipping_method_id: string | null;
        discount_id: string | null;
        tax_document_type: "receipt" | "invoice";
        invoice_company_name: string | null;
        invoice_afm: string | null;
        invoice_doy: string | null;
        invoice_activity: string | null;
      }[]
    >`SELECT * FROM shop.cart WHERE id = ${cartId} FOR UPDATE`;

    if (!cart) throw new CheckoutError("Cart not found", "not_found");
    if (cart.status === "completed") throw new CheckoutError("Cart already completed", "already_completed");
    if (!cart.email || !cart.shipping_address || !cart.shipping_method_id) {
      throw new CheckoutError("Missing checkout details", "missing_details");
    }

    // Re-price from the live variant, never from the cart's snapshot. The
    // snapshot exists so the cart displays coherently; what the customer is
    // charged always comes from the product record as it is right now.
    const items = await tx<
      {
        variant_id: string;
        product_id: string;
        quantity: number;
        title: string;
        variant_title: string;
        sku: string | null;
        slug: string;
        price_cents: number;
        stock_quantity: number;
        allow_backorder: boolean;
        // Was missing from this query entirely (pre-existing bug, unrelated
        // to Heraklion): computeTotals's oversized-item surcharge branch
        // never saw this column here, so it was always 0 at order-completion
        // time even for a heavy product, even though the same cart correctly
        // showed the surcharge right up until the moment of purchase. Fixed
        // alongside this feature because the Heraklion test matrix (item 13)
        // explicitly exercises "Heraklion + heavy product" through this exact
        // function.
        shipping_cost_cents: number | null;
      }[]
    >`SELECT i.variant_id, v.product_id, i.quantity,
             p.title, v.title AS variant_title, v.sku, p.slug,
             v.price_cents, v.stock_quantity, v.allow_backorder, p.shipping_cost_cents
        FROM shop.cart_item i
        JOIN shop.product_variant v ON v.id = i.variant_id
        JOIN shop.product p ON p.id = v.product_id
       WHERE i.cart_id = ${cartId}
       ORDER BY i.created_at`;

    if (items.length === 0) throw new CheckoutError("Cart is empty", "empty_cart");

    // Re-validate the discount at completion time: a code can expire, be
    // deactivated, or hit its redemption cap between adding it to the cart
    // and paying. Anything wrong simply drops the discount rather than
    // failing the order.
    let discount: { id: string; type: "percentage" | "fixed"; value: number; min_subtotal_cents: number; code: string } | null =
      null;
    if (cart.discount_id) {
      const [d] = await tx<
        {
          id: string;
          code: string;
          type: "percentage" | "fixed";
          value: number;
          min_subtotal_cents: number;
        }[]
      >`SELECT id, code, type, value, min_subtotal_cents
          FROM shop.discount
         WHERE id = ${cart.discount_id} AND is_active
           AND (starts_at IS NULL OR starts_at <= now())
           AND (ends_at IS NULL OR ends_at > now())
           AND (max_redemptions IS NULL OR redemption_count < max_redemptions)
         FOR UPDATE`;
      if (d) discount = d;
    }

    const [shipping] = await tx<
      {
        id: string; name: string; price_cents: number; free_over_cents: number | null;
        is_pickup: boolean; heraklion_only: boolean;
      }[]
    >`SELECT id, name, price_cents, free_over_cents, is_pickup, heraklion_only
        FROM shop.shipping_method WHERE id = ${cart.shipping_method_id}`;
    if (!shipping) throw new CheckoutError("Shipping method unavailable", "missing_details");

    // Final, authoritative gate before the price is ever charged. The cart
    // was locked FOR UPDATE above, so this reads the same address the order
    // is about to be placed with — a Heraklion-priced method can only ever
    // be charged for a cart whose own saved address genuinely is Heraklion,
    // regardless of what setShippingMethod validated minutes earlier or what
    // the client sends.
    if (
      shipping.heraklion_only &&
      !isHeraklionAddress(cart.shipping_address as { city?: string | null; postal_code?: string | null } | null)
    ) {
      throw new CheckoutError("Shipping method unavailable", "missing_details");
    }

    // Re-validated at completion time, same as shipping above: a method the
    // customer selected minutes ago may have been disabled by the owner
    // since. Never trust the client-supplied code past this check.
    const [payment] = await tx<{ code: string }[]>`
      SELECT code FROM shop.payment_method WHERE code = ${paymentMethodCode} AND is_active`;
    if (!payment) throw new CheckoutError("Payment method unavailable", "missing_details");

    // Same arithmetic the cart displayed — one implementation, imported, not
    // reimplemented here. The customer is charged what they were shown.
    const totals = computeTotals({
      items: items.map((i) => ({
        unit_price_cents: i.price_cents,
        quantity: i.quantity,
        shipping_cost_cents: i.shipping_cost_cents,
      })),
      discount: discount
        ? { type: discount.type, value: discount.value, min_subtotal_cents: discount.min_subtotal_cents }
        : null,
      shipping: {
        price_cents: shipping.price_cents,
        free_over_cents: shipping.free_over_cents,
        is_pickup: shipping.is_pickup,
      },
    });

    // --- Stock. The WHERE clause is the concurrency control: two concurrent
    // transactions cannot both satisfy `stock_quantity >= quantity` for the
    // last unit, because the second blocks on the first's row lock and then
    // re-evaluates against the committed value. A read-then-write would let
    // both through.
    for (const item of items) {
      const updated = await tx`
        UPDATE shop.product_variant
           SET stock_quantity = stock_quantity - ${item.quantity}
         WHERE id = ${item.variant_id}
           AND (allow_backorder OR stock_quantity >= ${item.quantity})`;
      if (updated.count === 0) {
        throw new CheckoutError(`Insufficient stock for ${item.sku ?? item.title}`, "insufficient_inventory");
      }
    }

    const [order] = await tx<{ id: string; order_number: number }[]>`
      INSERT INTO shop.orders (
        customer_id, email, status, payment_status, fulfillment_status,
        subtotal_cents, discount_cents, shipping_cents, vat_cents, total_cents, vat_rate,
        shipping_address, billing_address, shipping_method_name, payment_method,
        discount_code, tax_document_type, invoice_company_name, invoice_afm,
        invoice_doy, invoice_activity)
      VALUES (
        ${customerId ?? cart.customer_id}, ${cart.email}, 'pending', 'unpaid', 'unfulfilled',
        ${totals.subtotalCents}, ${totals.discountCents}, ${totals.shippingCents},
        ${totals.vatCents}, ${totals.totalCents}, ${totals.vatRate},
        ${cart.shipping_address as never}, ${(cart.billing_address ?? cart.shipping_address) as never},
        ${shipping.name}, ${payment.code}, ${discount?.code ?? null},
        ${cart.tax_document_type}, ${cart.invoice_company_name}, ${cart.invoice_afm},
        ${cart.invoice_doy}, ${cart.invoice_activity})
      RETURNING id, order_number`;

    for (const item of items) {
      await tx`
        INSERT INTO shop.order_item (
          order_id, variant_id, product_id, title, variant_title, sku,
          product_slug, quantity, unit_price_cents, line_total_cents)
        VALUES (
          ${order.id}, ${item.variant_id}, ${item.product_id}, ${item.title},
          ${item.variant_title}, ${item.sku}, ${item.slug}, ${item.quantity},
          ${item.price_cents}, ${item.price_cents * item.quantity})`;

      // Audit trail, so "why is this product at 3?" has an answer.
      await tx`
        INSERT INTO shop.inventory_movement (variant_id, delta, reason, order_id)
        VALUES (${item.variant_id}, ${-item.quantity}, 'order', ${order.id})`;
    }

    if (discount) {
      await tx`
        UPDATE shop.discount SET redemption_count = redemption_count + 1 WHERE id = ${discount.id}`;
      await tx`
        INSERT INTO shop.discount_redemption (discount_id, order_id, customer_id)
        VALUES (${discount.id}, ${order.id}, ${customerId ?? cart.customer_id})`;
    }

    // Loyalty reward — €5 coupon, credited only once the order is real
    // (this is the same transaction that just decremented stock and
    // inserted the order row, so "order completed" and "reward issued" can
    // never disagree). Requires an account: rewardCustomerId is null for a
    // guest who did not create one during this checkout, in which case
    // nothing is issued, matching the spec's "account creation is required"
    // rule exactly. source_order_id's unique index (0025 migration) is the
    // idempotency guard on top of completeOrder's own once-per-cart
    // guarantee — a retried call for an already-completed cart never
    // reaches this code at all (the `status = 'completed'` check above
    // throws first).
    const rewardCustomerId = customerId ?? cart.customer_id;
    let loyaltyReward: { code: string; endsAt: Date | null } | null = null;
    if (rewardCustomerId && totals.subtotalCents >= LOYALTY_REWARD_THRESHOLD_CENTS) {
      const [settings] = await tx<{ loyalty_reward_expiry_days: number | null }[]>`
        SELECT loyalty_reward_expiry_days FROM shop.site_setting LIMIT 1`;
      const expiryDays = settings?.loyalty_reward_expiry_days ?? LOYALTY_REWARD_DEFAULT_EXPIRY_DAYS;
      const endsAt = expiryDays != null ? new Date(Date.now() + expiryDays * 86_400_000) : null;

      // Check-then-insert for code uniqueness, same pattern saveDiscount
      // (lib/admin/discounts.ts) already uses for admin-created codes — not
      // a new, weaker guarantee. A collision inside a 33^6 code space is
      // astronomically unlikely for a shop that will never have anywhere
      // near that many discount rows.
      let code: string | null = null;
      for (let attempt = 0; attempt < 5 && !code; attempt++) {
        const candidate = randomLoyaltyCode();
        const [clash] = await tx<{ id: string }[]>`
          SELECT id FROM shop.discount WHERE lower(code) = lower(${candidate})`;
        if (!clash) code = candidate;
      }

      if (code) {
        const [reward] = await tx<{ code: string; ends_at: Date | null }[]>`
          INSERT INTO shop.discount (
            code, description, type, value, min_subtotal_cents,
            ends_at, max_redemptions, is_active, owner_customer_id, source_order_id)
          VALUES (
            ${code}, ${`Ανταμοιβή πιστότητας — παραγγελία #${order.order_number}`}, 'fixed',
            ${LOYALTY_REWARD_VALUE_CENTS}, 0, ${endsAt}, 1, true, ${rewardCustomerId}, ${order.id})
          RETURNING code, ends_at`;
        if (reward) loyaltyReward = { code: reward.code, endsAt: reward.ends_at };
      }
      // If code generation somehow exhausted its retries, the order still
      // completes without a reward rather than failing the customer's
      // purchase over it — same "never let a secondary concern block an
      // already-valid order" principle as the confirmation email below.
    }

    await tx`
      INSERT INTO shop.order_event (order_id, type, to_status, note)
      VALUES (${order.id}, 'created', 'pending', 'Order placed by customer')`;

    // The cart is retired, not deleted — it is the audit trail of what was in
    // it, and order_item already holds the immutable snapshot.
    await tx`UPDATE shop.cart SET status = 'completed' WHERE id = ${cartId}`;

    return {
      id: order.id,
      orderNumber: order.order_number,
      email: cart.email,
      totalCents: totals.totalCents,
      items: items.map((i) => ({
        title: i.title,
        quantity: i.quantity,
        lineTotalCents: i.price_cents * i.quantity,
      })),
      loyaltyReward: loyaltyReward ? { code: loyaltyReward.code, endsAt: loyaltyReward.endsAt?.toISOString() ?? null } : null,
    };
  });
}
