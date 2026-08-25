import "server-only";
import { sql } from "@/lib/db/client";

/**
 * Server-side wishlist persistence for logged-in customers. Guests still
 * use localStorage only (lib/wishlist-storage.ts) — this is what makes
 * favorites survive a login on a different browser/device, and what the
 * guest→account merge on login writes into.
 *
 * Keyed by product handle (slug) at the call boundary, same as the guest
 * store, so WishlistProvider doesn't need two different identifier shapes
 * depending on login state — resolution to/from shop.product.id happens
 * here, invisibly to callers. A handle that doesn't resolve to a real,
 * active product (deleted/renamed) is silently skipped, never an error —
 * same "invalid id never breaks the page" rule as getProductsBySlugs.
 */

export async function getWishlistHandles(customerId: string): Promise<string[]> {
  const rows = await sql<{ slug: string }[]>`
    SELECT p.slug FROM shop.wishlist_item w
    JOIN shop.product p ON p.id = w.product_id
    WHERE w.customer_id = ${customerId} AND p.is_active
    ORDER BY w.created_at DESC`;
  return rows.map((r) => r.slug);
}

export async function addWishlistItem(customerId: string, handle: string): Promise<void> {
  await sql`
    INSERT INTO shop.wishlist_item (customer_id, product_id)
    SELECT ${customerId}, id FROM shop.product WHERE slug = ${handle} AND is_active
    ON CONFLICT DO NOTHING`;
}

export async function removeWishlistItem(customerId: string, handle: string): Promise<void> {
  await sql`
    DELETE FROM shop.wishlist_item w
    USING shop.product p
    WHERE w.product_id = p.id AND p.slug = ${handle} AND w.customer_id = ${customerId}`;
}

/**
 * Guest→account merge on login/register. `ON CONFLICT DO NOTHING` makes
 * this naturally idempotent and duplicate-free — merging the same handles
 * twice (e.g. a retried request) never errors and never double-inserts.
 * Returns the merged, authoritative set.
 */
export async function mergeWishlistHandles(customerId: string, handles: string[]): Promise<string[]> {
  if (handles.length > 0) {
    await sql`
      INSERT INTO shop.wishlist_item (customer_id, product_id)
      SELECT ${customerId}, p.id FROM shop.product p
      WHERE p.slug = ANY(${handles}) AND p.is_active
      ON CONFLICT DO NOTHING`;
  }
  return getWishlistHandles(customerId);
}
