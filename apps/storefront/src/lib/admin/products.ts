import "server-only";
import { sql, transaction } from "@/lib/db/client";
import { normalizeSearchText } from "@/lib/search";

/**
 * Admin catalog queries and mutations.
 *
 * Reads here differ from the storefront's on purpose: the admin sees
 * inactive products, out-of-stock variants and everything else the shop
 * hides. Never reuse a storefront query for an admin list — the filters that
 * make a storefront correct make an admin blind.
 */

export type AdminProductRow = {
  id: string;
  slug: string;
  title: string;
  isActive: boolean;
  categoryName: string | null;
  categorySlug: string | null;
  variantCount: number;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  onSale: boolean;
  totalStock: number;
  imageCount: number;
  createdAt: string;
};

export type ProductListFilters = {
  q?: string;
  status?: "all" | "active" | "inactive";
  stock?: "all" | "low" | "out";
  categoryId?: string;
  collectionId?: string;
  sort?: "newest" | "title" | "price-asc" | "price-desc" | "stock-asc";
  page?: number;
  perPage?: number;
};

function orderBy(sort: ProductListFilters["sort"]) {
  switch (sort) {
    case "title": return sql`ORDER BY p.title COLLATE "el-GR-x-icu" ASC`;
    case "price-asc": return sql`ORDER BY min_price_cents ASC NULLS LAST`;
    case "price-desc": return sql`ORDER BY min_price_cents DESC NULLS LAST`;
    case "stock-asc": return sql`ORDER BY total_stock ASC`;
    default: return sql`ORDER BY p.created_at DESC`;
  }
}

/**
 * Search matches title, slug or SKU. Deliberately ILIKE rather than the
 * storefront's Greek fuzzy ranking: an operator looking for a product knows
 * what it is called, and wants "τηγ" to narrow the list predictably, not to
 * be reordered by relevance tiers. Accent-insensitivity still matters though,
 * so the query is folded the same way the storefront folds it and compared
 * against a folded title.
 */
export async function listProducts(filters: ProductListFilters = {}): Promise<{
  products: AdminProductRow[];
  total: number;
  page: number;
  perPage: number;
}> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(10, filters.perPage ?? 25));
  const offset = (page - 1) * perPage;

  const q = filters.q?.trim();
  const folded = q ? normalizeSearchText(q) : null;

  const rows = (await sql`
    SELECT p.id, p.slug, p.title, p.is_active, p.created_at,
           c.name AS category_name, c.slug AS category_slug,
           (SELECT COUNT(*) FROM shop.product_variant v WHERE v.product_id = p.id)::int AS variant_count,
           (SELECT MIN(v.price_cents) FROM shop.product_variant v WHERE v.product_id = p.id) AS min_price_cents,
           (SELECT MAX(v.price_cents) FROM shop.product_variant v WHERE v.product_id = p.id) AS max_price_cents,
           (SELECT COUNT(*) > 0 FROM shop.product_variant v
             WHERE v.product_id = p.id AND v.compare_at_price_cents > v.price_cents) AS on_sale,
           COALESCE((SELECT SUM(v.stock_quantity) FROM shop.product_variant v WHERE v.product_id = p.id), 0)::int AS total_stock,
           (SELECT COUNT(*) FROM shop.product_image i WHERE i.product_id = p.id)::int AS image_count,
           COUNT(*) OVER () AS total_count
      FROM shop.product p
      LEFT JOIN shop.category c ON c.id = p.category_id
     WHERE TRUE
       ${filters.status === "active" ? sql`AND p.is_active` : sql``}
       ${filters.status === "inactive" ? sql`AND NOT p.is_active` : sql``}
       ${filters.categoryId ? sql`AND p.category_id = ${filters.categoryId}` : sql``}
       ${filters.collectionId
         ? sql`AND EXISTS (SELECT 1 FROM shop.product_collection pc
                            WHERE pc.product_id = p.id AND pc.collection_id = ${filters.collectionId})`
         : sql``}
       ${filters.stock === "out"
         ? sql`AND NOT EXISTS (SELECT 1 FROM shop.product_variant v
                                WHERE v.product_id = p.id AND (v.allow_backorder OR v.stock_quantity > 0))`
         : sql``}
       ${filters.stock === "low"
         ? sql`AND EXISTS (SELECT 1 FROM shop.product_variant v
                            WHERE v.product_id = p.id AND NOT v.allow_backorder
                              AND v.stock_quantity > 0 AND v.stock_quantity <= 5)`
         : sql``}
       ${folded
         ? sql`AND (
                 translate(lower(p.title), 'άέήίόύώΐΰϊϋς', 'αεηιουωιυιυσ') LIKE ${"%" + folded + "%"}
                 OR p.slug ILIKE ${"%" + q + "%"}
                 OR EXISTS (SELECT 1 FROM shop.product_variant v
                             WHERE v.product_id = p.id AND v.sku ILIKE ${"%" + q + "%"})
               )`
         : sql``}
     ${orderBy(filters.sort)}
     LIMIT ${perPage} OFFSET ${offset}
  `) as unknown as Array<{
    id: string; slug: string; title: string; is_active: boolean; created_at: Date;
    category_name: string | null; category_slug: string | null; variant_count: number;
    min_price_cents: number | null; max_price_cents: number | null; on_sale: boolean;
    total_stock: number; image_count: number; total_count: string;
  }>;

  return {
    products: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      isActive: r.is_active,
      categoryName: r.category_name,
      categorySlug: r.category_slug,
      variantCount: r.variant_count,
      minPriceCents: r.min_price_cents,
      maxPriceCents: r.max_price_cents,
      onSale: r.on_sale,
      totalStock: r.total_stock,
      imageCount: r.image_count,
      createdAt: new Date(r.created_at).toISOString(),
    })),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    perPage,
  };
}

// ---------------------------------------------------------------------------
// Single product (editor)
// ---------------------------------------------------------------------------

export type AdminVariant = {
  id: string;
  sku: string;
  title: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stockQuantity: number;
  allowBackorder: boolean;
  position: number;
  isActive: boolean;
};

export type AdminProductImage = {
  id: string;
  storagePath: string;
  altText: string | null;
  position: number;
};

export type AdminProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  isActive: boolean;
  isNewOverride: boolean;
  vatRate: number | null;
  material: string | null;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  originCountry: string | null;
  badgeLabel: string | null;
  badgeTone: "accent" | "success" | "neutral";
  warrantyText: string | null;
  downloadsUrl: string | null;
  hideFromSearch: boolean;
  isSearchBoosted: boolean;
  createdAt: string;
  updatedAt: string;
  variants: AdminVariant[];
  images: AdminProductImage[];
  collectionIds: string[];
  seo: {
    seoTitle: string | null;
    metaDescription: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    keywords: string | null;
    robots: "index" | "noindex";
  } | null;
};

export async function getProductForEdit(id: string): Promise<AdminProductDetail | null> {
  const rows = (await sql`
    SELECT p.*,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', v.id, 'sku', v.sku, 'title', v.title, 'priceCents', v.price_cents,
          'compareAtPriceCents', v.compare_at_price_cents, 'stockQuantity', v.stock_quantity,
          'allowBackorder', v.allow_backorder, 'position', v.position, 'isActive', v.is_active
        ) ORDER BY v.position, v.created_at)
        FROM shop.product_variant v WHERE v.product_id = p.id), '[]'::json) AS variants,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', i.id, 'storagePath', i.storage_path, 'altText', i.alt_text, 'position', i.position
        ) ORDER BY i.position)
        FROM shop.product_image i WHERE i.product_id = p.id), '[]'::json) AS images,
      COALESCE((
        SELECT json_agg(pc.collection_id)
        FROM shop.product_collection pc WHERE pc.product_id = p.id), '[]'::json) AS collection_ids,
      (SELECT row_to_json(s) FROM (
         SELECT seo_title AS "seoTitle", meta_description AS "metaDescription",
                og_title AS "ogTitle", og_description AS "ogDescription",
                keywords, robots
           FROM shop.seo_meta
          WHERE resource_type = 'product' AND resource_id = p.id::text) s) AS seo
    FROM shop.product p WHERE p.id = ${id}`) as unknown as Array<
    Record<string, unknown> & {
      variants: AdminVariant[];
      images: AdminProductImage[];
      collection_ids: string[];
      seo: AdminProductDetail["seo"];
    }
  >;

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    categoryId: (r.category_id as string) ?? null,
    isActive: r.is_active as boolean,
    isNewOverride: r.is_new_override as boolean,
    vatRate: r.vat_rate != null ? Number(r.vat_rate) : null,
    material: (r.material as string) ?? null,
    weightGrams: (r.weight_grams as number) ?? null,
    lengthCm: r.length_cm != null ? Number(r.length_cm) : null,
    widthCm: r.width_cm != null ? Number(r.width_cm) : null,
    heightCm: r.height_cm != null ? Number(r.height_cm) : null,
    originCountry: (r.origin_country as string) ?? null,
    badgeLabel: (r.badge_label as string) ?? null,
    badgeTone: (r.badge_tone as AdminProductDetail["badgeTone"]) ?? "neutral",
    warrantyText: (r.warranty_text as string) ?? null,
    downloadsUrl: (r.downloads_url as string) ?? null,
    hideFromSearch: r.hide_from_search as boolean,
    isSearchBoosted: r.is_search_boosted as boolean,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
    variants: r.variants,
    images: r.images,
    collectionIds: r.collection_ids ?? [],
    seo: r.seo,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export class CatalogError extends Error {
  constructor(message: string, public readonly code: "duplicate_slug" | "duplicate_sku" | "not_found" | "last_variant") {
    super(message);
  }
}

/** URL-safe slug from a Greek title. Transliterates rather than stripping — a
 *  Greek title must not collapse to an empty slug. */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
    κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
    ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
  };
  return normalizeSearchText(input)
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type ProductInput = {
  title: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  isActive: boolean;
  isNewOverride: boolean;
  material: string | null;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  originCountry: string | null;
  badgeLabel: string | null;
  badgeTone: "accent" | "success" | "neutral";
  warrantyText: string | null;
  downloadsUrl: string | null;
  hideFromSearch: boolean;
  isSearchBoosted: boolean;
  collectionIds: string[];
  seo: {
    seoTitle: string | null;
    metaDescription: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    keywords: string | null;
    robots: "index" | "noindex";
  };
};

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  await transaction(async (tx) => {
    const dupe = await tx<{ id: string }[]>`
      SELECT id FROM shop.product WHERE slug = ${input.slug} AND id <> ${id}`;
    if (dupe.length > 0) throw new CatalogError("Slug already in use", "duplicate_slug");

    const updated = await tx`
      UPDATE shop.product SET
        title = ${input.title}, slug = ${input.slug}, description = ${input.description},
        category_id = ${input.categoryId}, is_active = ${input.isActive},
        is_new_override = ${input.isNewOverride}, material = ${input.material},
        weight_grams = ${input.weightGrams}, length_cm = ${input.lengthCm},
        width_cm = ${input.widthCm}, height_cm = ${input.heightCm},
        origin_country = ${input.originCountry}, badge_label = ${input.badgeLabel},
        badge_tone = ${input.badgeTone}, warranty_text = ${input.warrantyText},
        downloads_url = ${input.downloadsUrl}, hide_from_search = ${input.hideFromSearch},
        is_search_boosted = ${input.isSearchBoosted}
      WHERE id = ${id}`;
    if (updated.count === 0) throw new CatalogError("Product not found", "not_found");

    await tx`DELETE FROM shop.product_collection WHERE product_id = ${id}`;
    for (const collectionId of input.collectionIds) {
      await tx`INSERT INTO shop.product_collection (product_id, collection_id)
               VALUES (${id}, ${collectionId}) ON CONFLICT DO NOTHING`;
    }

    const s = input.seo;
    const hasSeo = s.seoTitle || s.metaDescription || s.ogTitle || s.ogDescription || s.keywords || s.robots === "noindex";
    if (hasSeo) {
      await tx`
        INSERT INTO shop.seo_meta (resource_type, resource_id, seo_title, meta_description,
                                   og_title, og_description, keywords, robots)
        VALUES ('product', ${id}, ${s.seoTitle}, ${s.metaDescription}, ${s.ogTitle},
                ${s.ogDescription}, ${s.keywords}, ${s.robots})
        ON CONFLICT (resource_type, resource_id) DO UPDATE SET
          seo_title = EXCLUDED.seo_title, meta_description = EXCLUDED.meta_description,
          og_title = EXCLUDED.og_title, og_description = EXCLUDED.og_description,
          keywords = EXCLUDED.keywords, robots = EXCLUDED.robots, updated_at = now()`;
    } else {
      // All fields cleared — remove the row rather than leaving an empty
      // override that silently shadows the page's own metadata.
      await tx`DELETE FROM shop.seo_meta WHERE resource_type = 'product' AND resource_id = ${id}`;
    }
  });
}

export async function createProduct(input: {
  title: string;
  slug: string;
  sku: string;
  priceCents: number;
  stockQuantity: number;
  categoryId: string | null;
}): Promise<string> {
  return transaction(async (tx) => {
    const dupeSlug = await tx<{ id: string }[]>`SELECT id FROM shop.product WHERE slug = ${input.slug}`;
    if (dupeSlug.length > 0) throw new CatalogError("Slug already in use", "duplicate_slug");
    const dupeSku = await tx<{ id: string }[]>`SELECT id FROM shop.product_variant WHERE sku = ${input.sku}`;
    if (dupeSku.length > 0) throw new CatalogError("SKU already in use", "duplicate_sku");

    const [p] = await tx<{ id: string }[]>`
      INSERT INTO shop.product (title, slug, category_id, is_active)
      VALUES (${input.title}, ${input.slug}, ${input.categoryId}, false)
      RETURNING id`;

    // Every product has at least one variant — the storefront's price and
    // stock live there, so a product without one is unsellable and invisible.
    await tx`
      INSERT INTO shop.product_variant (product_id, sku, title, price_cents, stock_quantity)
      VALUES (${p.id}, ${input.sku}, 'Default', ${input.priceCents}, ${input.stockQuantity})`;

    return p.id;
  });
}

export async function saveVariant(
  productId: string,
  variant: {
    id?: string;
    sku: string;
    title: string;
    priceCents: number;
    compareAtPriceCents: number | null;
    stockQuantity: number;
    allowBackorder: boolean;
    isActive: boolean;
  }
): Promise<void> {
  const dupe = await sql<{ id: string }[]>`
    SELECT id FROM shop.product_variant
     WHERE sku = ${variant.sku} ${variant.id ? sql`AND id <> ${variant.id}` : sql``}`;
  if (dupe.length > 0) throw new CatalogError("SKU already in use", "duplicate_sku");

  if (variant.id) {
    await sql`
      UPDATE shop.product_variant SET
        sku = ${variant.sku}, title = ${variant.title}, price_cents = ${variant.priceCents},
        compare_at_price_cents = ${variant.compareAtPriceCents},
        stock_quantity = ${variant.stockQuantity}, allow_backorder = ${variant.allowBackorder},
        is_active = ${variant.isActive}
      WHERE id = ${variant.id} AND product_id = ${productId}`;
    return;
  }

  const [{ next }] = await sql<{ next: number }[]>`
    SELECT COALESCE(MAX(position), -1) + 1 AS next FROM shop.product_variant WHERE product_id = ${productId}`;
  await sql`
    INSERT INTO shop.product_variant (product_id, sku, title, price_cents,
      compare_at_price_cents, stock_quantity, allow_backorder, is_active, position)
    VALUES (${productId}, ${variant.sku}, ${variant.title}, ${variant.priceCents},
      ${variant.compareAtPriceCents}, ${variant.stockQuantity}, ${variant.allowBackorder},
      ${variant.isActive}, ${next})`;
}

export async function deleteVariant(productId: string, variantId: string): Promise<void> {
  const [{ count }] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM shop.product_variant WHERE product_id = ${productId}`;
  // Refusing here rather than cascading: a product with zero variants has no
  // price and no stock, so it would silently vanish from the storefront.
  if (count <= 1) throw new CatalogError("Cannot delete the only variant", "last_variant");
  await sql`DELETE FROM shop.product_variant WHERE id = ${variantId} AND product_id = ${productId}`;
}

/** Adjusts stock and records why. Every stock change goes through here. */
export async function adjustStock(
  variantId: string,
  newQuantity: number,
  adminUserId: string,
  reason: "manual" | "correction" = "manual",
  note?: string
): Promise<void> {
  await transaction(async (tx) => {
    const [v] = await tx<{ stock_quantity: number }[]>`
      SELECT stock_quantity FROM shop.product_variant WHERE id = ${variantId} FOR UPDATE`;
    if (!v) throw new CatalogError("Variant not found", "not_found");
    const delta = newQuantity - v.stock_quantity;
    if (delta === 0) return;

    await tx`UPDATE shop.product_variant SET stock_quantity = ${newQuantity} WHERE id = ${variantId}`;
    await tx`
      INSERT INTO shop.inventory_movement (variant_id, delta, reason, admin_user_id, note)
      VALUES (${variantId}, ${delta}, ${reason}, ${adminUserId}, ${note ?? null})`;
  });
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

export type BulkResult = { affected: number };

export async function bulkSetActive(ids: string[], isActive: boolean): Promise<BulkResult> {
  if (ids.length === 0) return { affected: 0 };
  const res = await sql`UPDATE shop.product SET is_active = ${isActive} WHERE id = ANY(${ids})`;
  return { affected: res.count };
}

export async function bulkSetCategory(ids: string[], categoryId: string | null): Promise<BulkResult> {
  if (ids.length === 0) return { affected: 0 };
  const res = await sql`UPDATE shop.product SET category_id = ${categoryId} WHERE id = ANY(${ids})`;
  return { affected: res.count };
}

export async function bulkAddToCollection(ids: string[], collectionId: string): Promise<BulkResult> {
  if (ids.length === 0) return { affected: 0 };
  const res = await sql`
    INSERT INTO shop.product_collection (product_id, collection_id)
    SELECT unnest(${ids}::uuid[]), ${collectionId}
    ON CONFLICT DO NOTHING`;
  return { affected: res.count };
}

/**
 * Percentage or fixed price change across many variants.
 *
 * GREATEST(..., 0) is not cosmetic: a -150% adjustment would otherwise write
 * a negative price, and the CHECK constraint would abort the whole batch
 * partway through. Clamping keeps a fat-fingered bulk edit recoverable.
 */
export async function bulkAdjustPrice(
  ids: string[],
  mode: "percent" | "fixed",
  value: number
): Promise<BulkResult> {
  if (ids.length === 0) return { affected: 0 };
  const res =
    mode === "percent"
      ? await sql`
          UPDATE shop.product_variant
             SET price_cents = GREATEST(ROUND(price_cents * (1 + ${value} / 100.0))::int, 0)
           WHERE product_id = ANY(${ids})`
      : await sql`
          UPDATE shop.product_variant
             SET price_cents = GREATEST(price_cents + ${Math.round(value * 100)}, 0)
           WHERE product_id = ANY(${ids})`;
  return { affected: res.count };
}

export async function bulkSetStock(ids: string[], quantity: number, adminUserId: string): Promise<BulkResult> {
  if (ids.length === 0) return { affected: 0 };
  return transaction(async (tx) => {
    const variants = await tx<{ id: string; stock_quantity: number }[]>`
      SELECT id, stock_quantity FROM shop.product_variant WHERE product_id = ANY(${ids}) FOR UPDATE`;
    for (const v of variants) {
      if (v.stock_quantity === quantity) continue;
      await tx`UPDATE shop.product_variant SET stock_quantity = ${quantity} WHERE id = ${v.id}`;
      await tx`
        INSERT INTO shop.inventory_movement (variant_id, delta, reason, admin_user_id, note)
        VALUES (${v.id}, ${quantity - v.stock_quantity}, 'manual', ${adminUserId}, 'Bulk stock update')`;
    }
    return { affected: variants.length };
  });
}

/**
 * Deactivate, not delete. A product referenced by an order_item must survive
 * so that order history stays readable — order_item snapshots the title and
 * SKU, but the link is worth keeping. Products with no order history are
 * genuinely deleted.
 */
export async function bulkArchive(ids: string[]): Promise<{ deleted: number; deactivated: number }> {
  if (ids.length === 0) return { deleted: 0, deactivated: 0 };
  return transaction(async (tx) => {
    const referenced = await tx<{ product_id: string }[]>`
      SELECT DISTINCT product_id FROM shop.order_item
       WHERE product_id = ANY(${ids}) AND product_id IS NOT NULL`;
    const keep = referenced.map((r) => r.product_id);
    const removable = ids.filter((id) => !keep.includes(id));

    let deactivated = 0;
    if (keep.length > 0) {
      const res = await tx`UPDATE shop.product SET is_active = false WHERE id = ANY(${keep})`;
      deactivated = res.count;
    }
    let deleted = 0;
    if (removable.length > 0) {
      const res = await tx`DELETE FROM shop.product WHERE id = ANY(${removable})`;
      deleted = res.count;
    }
    return { deleted, deactivated };
  });
}

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

export async function listCategoryOptions(): Promise<Array<{ id: string; name: string; depth: number }>> {
  const rows = await sql<{ id: string; name: string; depth: number }[]>`
    WITH RECURSIVE tree AS (
      SELECT id, name, parent_id, 0 AS depth, name AS path
        FROM shop.category WHERE parent_id IS NULL
      UNION ALL
      SELECT c.id, c.name, c.parent_id, t.depth + 1, t.path || ' / ' || c.name
        FROM shop.category c JOIN tree t ON c.parent_id = t.id
    )
    SELECT id, name, depth FROM tree ORDER BY path COLLATE "el-GR-x-icu"`;
  return rows;
}

export async function listCollectionOptions(): Promise<Array<{ id: string; title: string }>> {
  return sql<{ id: string; title: string }[]>`
    SELECT id, title FROM shop.collection ORDER BY title COLLATE "el-GR-x-icu"`;
}
