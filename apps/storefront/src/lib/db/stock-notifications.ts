import "server-only";
import { sql } from "@/lib/db/client";

/**
 * «Ενημέρωσέ με όταν παραληφθεί» requests (shop.stock_notification_request,
 * migration 0032). This file only stores, claims and removes them; sending
 * lives in lib/stock-notifications.ts.
 *
 * An email address here is used for exactly one thing — telling that person
 * the variant is back in stock — and the row is deleted once that email has
 * gone out (deleteStockNotification).
 */

export type StockNotificationRequestResult = "created" | "not_sold_out";

/**
 * Stores a request for a variant that is genuinely sold out right now —
 * checked here, not trusted from the form, so a stale page can't queue a
 * request for something that's already buyable. A duplicate pending request
 * (same variant, same email in any case) is silently a no-op, and reports
 * "created" all the same: whether an email already asked is nobody's business.
 */
export async function createStockNotificationRequest(
  variantId: string,
  email: string
): Promise<StockNotificationRequestResult> {
  const [variant] = await sql<{ sold_out: boolean }[]>`
    SELECT (v.stock_quantity <= 0) AS sold_out
      FROM shop.product_variant v
      JOIN shop.product p ON p.id = v.product_id
     WHERE v.id = ${variantId} AND v.is_active AND p.is_active`;
  if (!variant?.sold_out) return "not_sold_out";

  await sql`
    INSERT INTO shop.stock_notification_request (variant_id, email)
    VALUES (${variantId}, ${email})
    ON CONFLICT (variant_id, lower(email)) WHERE notified_at IS NULL DO NOTHING`;
  return "created";
}

export type ClaimedStockNotification = {
  id: string;
  email: string;
  productTitle: string;
  productSlug: string;
  variantTitle: string;
};

/**
 * Atomically marks pending requests whose variant has stock again as
 * in-flight (notified_at), and returns them for sending. Claim-then-send so
 * two restocks landing together can't email the same person twice: SKIP
 * LOCKED hands each row to exactly one caller. After the send, the row is
 * deleted on success or released on failure.
 */
export async function claimRestockedNotifications(limit = 100): Promise<ClaimedStockNotification[]> {
  const rows = await sql<
    { id: string; email: string; product_title: string; product_slug: string; variant_title: string }[]
  >`
    UPDATE shop.stock_notification_request r
       SET notified_at = now()
      FROM shop.product_variant v
      JOIN shop.product p ON p.id = v.product_id
     WHERE r.variant_id = v.id
       AND r.notified_at IS NULL
       AND r.id IN (
         SELECT r2.id
           FROM shop.stock_notification_request r2
           JOIN shop.product_variant v2 ON v2.id = r2.variant_id
           JOIN shop.product p2 ON p2.id = v2.product_id
          WHERE r2.notified_at IS NULL
            AND v2.stock_quantity > 0 AND v2.is_active AND p2.is_active
          ORDER BY r2.created_at
          LIMIT ${limit}
          FOR UPDATE OF r2 SKIP LOCKED
       )
    RETURNING r.id, r.email, p.title AS product_title, p.slug AS product_slug, v.title AS variant_title`;

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    productTitle: r.product_title,
    productSlug: r.product_slug,
    variantTitle: r.variant_title,
  }));
}

/** The notification was sent — its purpose is fulfilled, so the email goes. */
export async function deleteStockNotification(id: string): Promise<void> {
  try {
    await sql`DELETE FROM shop.stock_notification_request WHERE id = ${id}`;
  } catch (err) {
    console.error("[stock-notify] DELETE_FAILED", { id, error: err instanceof Error ? err.message : String(err) });
  }
}

/** Puts a claimed request back in the queue after its email failed to send. */
export async function releaseStockNotification(id: string): Promise<void> {
  try {
    await sql`UPDATE shop.stock_notification_request SET notified_at = NULL WHERE id = ${id}`;
  } catch (err) {
    // The one expected failure: the same person asked again for the same
    // variant after this row was claimed, so a newer pending row already
    // exists (unique index) — that one gets sent on the next restock instead.
    console.error("[stock-notify] RELEASE_FAILED", { id, error: err instanceof Error ? err.message : String(err) });
  }
}
