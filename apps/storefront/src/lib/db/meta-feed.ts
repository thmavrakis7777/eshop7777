import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db/client";
import { publicImageUrl } from "@/lib/storage/urls";
import { siteUrl } from "@/lib/site-config";
import { getBranding } from "@/lib/data/branding";

/**
 * The Meta/Facebook/Instagram product catalog feed's data layer.
 *
 * One row per VARIANT, not per product — Meta's catalog unit is a single
 * purchasable item, the same granularity `shop.product_variant` already is.
 * A single-variant product (the overwhelming majority of this catalog
 * today) is one feed row; a real multi-variant product would be several,
 * grouped by `item_group_id`.
 *
 * Cache invalidation: `updateTag(META_FEED_CACHE_TAG)`, not `revalidateTag`
 * — every call site here is inside a Server Action (catalog-actions.ts),
 * and Next's own type declaration for `revalidateTag` says plainly: "For
 * immediate expiration in Server Actions, use updateTag instead." Tried
 * `revalidateTag(tag, "max")` first; its stale-while-revalidate semantics
 * left this feed serving old data across several manual re-fetches in
 * local testing (a background revalidation that never visibly completed),
 * where `updateTag` invalidated it immediately and consistently — matching
 * the same pattern catalog-actions.ts already uses for the search cache
 * (`updateTag(SEARCH_CACHE_TAG)`).
 */
export const META_FEED_CACHE_TAG = "meta-product-feed";

export type MetaFeedRow = {
  id: string; // variant UUID — immutable, unlike SKU which can be edited
  itemGroupId: string | null; // set only when the product has >1 active variant
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  condition: "new";
  priceCents: number; // the ORIGINAL/regular price Meta shows struck through when on sale
  salePriceCents: number | null; // the current selling price, only when actually discounted
  link: string;
  imageLink: string | null;
  additionalImageLinks: string[];
  brand: string;
  productType: string | null; // "Parent > Child" from the real category tree
  sku: string;
};

type FeedQueryRow = {
  variant_id: string;
  sku: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_quantity: number;
  allow_backorder: boolean;
  active_variant_count: number;
  slug: string;
  title: string;
  description: string | null;
  category_name: string | null;
  parent_category_name: string | null;
  image_paths: string[];
};

async function queryFeedRows(): Promise<FeedQueryRow[]> {
  return sql<FeedQueryRow[]>`
    SELECT
      v.id AS variant_id, v.sku, v.price_cents, v.compare_at_price_cents,
      v.stock_quantity, v.allow_backorder,
      (SELECT COUNT(*) FROM shop.product_variant v2
        WHERE v2.product_id = p.id AND v2.is_active)::int AS active_variant_count,
      p.slug, p.title, p.description,
      c.name AS category_name, pc.name AS parent_category_name,
      COALESCE((
        SELECT json_agg(i.storage_path ORDER BY i.position)
          FROM shop.product_image i WHERE i.product_id = p.id
      ), '[]'::json) AS image_paths
    FROM shop.product_variant v
    JOIN shop.product p ON p.id = v.product_id
    LEFT JOIN shop.category c ON c.id = p.category_id
    LEFT JOIN shop.category pc ON pc.id = c.parent_id
    WHERE p.is_active AND v.is_active
    ORDER BY p.slug, v.position`;
}

const getCachedFeedRows = unstable_cache(queryFeedRows, ["meta-feed-rows"], {
  revalidate: 300,
  tags: [META_FEED_CACHE_TAG],
});

export async function getMetaFeedRows(): Promise<MetaFeedRow[]> {
  const [rows, branding] = await Promise.all([getCachedFeedRows(), getBranding()]);

  return rows.map((r): MetaFeedRow => {
    const onSale = r.compare_at_price_cents != null && r.compare_at_price_cents > r.price_cents;
    // Meta wants `price` as the regular/pre-discount figure and `sale_price`
    // as what the customer actually pays — the inverse of how this schema
    // names the columns (price_cents IS the current selling price).
    const priceCents = onSale ? r.compare_at_price_cents! : r.price_cents;
    const salePriceCents = onSale ? r.price_cents : null;

    const images = r.image_paths.map((p) => publicImageUrl(p)).filter((u): u is string => Boolean(u));

    const productType =
      r.category_name && r.parent_category_name
        ? `${r.parent_category_name} > ${r.category_name}`
        : r.category_name;

    return {
      id: r.variant_id,
      itemGroupId: r.active_variant_count > 1 ? r.slug : null,
      title: r.title,
      description: r.description ?? r.title,
      availability: r.stock_quantity > 0 || r.allow_backorder ? "in stock" : "out of stock",
      condition: "new",
      priceCents,
      salePriceCents,
      link: `${siteUrl}/proionta/${r.slug}`,
      imageLink: images[0] ?? null,
      additionalImageLinks: images.slice(1, 11), // Meta's own cap is 10 additional images
      brand: branding.storeName,
      productType,
      sku: r.sku,
    };
  });
}
