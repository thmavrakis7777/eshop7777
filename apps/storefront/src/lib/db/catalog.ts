import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db/client";
import { publicImageUrl } from "@/lib/storage/urls";
import type { Product, ProductCharacteristics, Tone } from "@/lib/types";

// Invalidated by product saves/deletes (catalog-actions.ts) and search
// synonym saves/deletes (settings-actions.ts).
export const SEARCH_CACHE_TAG = "search-catalog";

/**
 * Every catalog read, as SQL. Replaces the HTTP round trips to Medusa's
 * Store API that lib/data/products.ts used to make — including the
 * `getDefaultRegionId()` call that preceded literally every catalog query
 * just to answer "we sell in euros".
 *
 * These functions return DOMAIN types (lib/types.ts), never row shapes, so
 * lib/data/* stays a thin pass-through and no component ever sees a column
 * name. Same boundary discipline as the Medusa adapter it replaces.
 */

const TONES: Tone[] = ["clay", "sage", "stone", "linen"];
const NEW_ARRIVAL_WINDOW_DAYS = 30;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

export function toneFor(handle: string): Tone {
  return TONES[Math.abs(hash(handle)) % TONES.length];
}

// Small, deliberately incomplete lookup for the manufacturing origins likely
// to appear on a Greek home-goods catalog — not a full ISO-3166 table. Falls
// back to the raw code so an unmapped country still displays something.
const COUNTRY_NAMES_EL: Record<string, string> = {
  gr: "Ελλάδα", it: "Ιταλία", de: "Γερμανία", fr: "Γαλλία", es: "Ισπανία",
  pt: "Πορτογαλία", nl: "Ολλανδία", tr: "Τουρκία", cn: "Κίνα", in: "Ινδία",
  pl: "Πολωνία", gb: "Ηνωμένο Βασίλειο",
};

type VariantRow = {
  id: string;
  title: string;
  sku: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_quantity: number;
  allow_backorder: boolean;
};

type ProductRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  created_at: Date;
  is_new_override: boolean;
  material: string | null;
  weight_grams: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  origin_country: string | null;
  category_slug: string | null;
  image_path: string | null;
  variants: VariantRow[];
  min_price_cents: number | null;
};

// Money crosses this boundary in whole euros, matching lib/types.ts's Money
// and what formatPrice() expects. Cents exist only inside the database.
const toEuros = (cents: number) => cents / 100;

function toCharacteristics(r: ProductRow): ProductCharacteristics | null {
  const c: ProductCharacteristics = {
    ...(r.material ? { material: r.material } : {}),
    ...(r.weight_grams != null ? { weightGrams: r.weight_grams } : {}),
    ...(r.length_cm != null ? { lengthCm: Number(r.length_cm) } : {}),
    ...(r.width_cm != null ? { widthCm: Number(r.width_cm) } : {}),
    ...(r.height_cm != null ? { heightCm: Number(r.height_cm) } : {}),
    ...(r.origin_country
      ? { originCountry: COUNTRY_NAMES_EL[r.origin_country.toLowerCase()] ?? r.origin_country }
      : {}),
  };
  return Object.keys(c).length > 0 ? c : null;
}

// A variant is purchasable unless stock has run out and backorders are off.
// Same rule the order-completion transaction enforces server-side — this is
// the UI-layer prediction of it, not a replacement for it.
const isVariantAvailable = (v: VariantRow) => v.allow_backorder || v.stock_quantity > 0;

function isNewArrival(r: ProductRow): boolean {
  if (r.is_new_override) return true;
  const ageDays = (Date.now() - new Date(r.created_at).getTime()) / 86_400_000;
  return ageDays <= NEW_ARRIVAL_WINDOW_DAYS;
}

export function toDomainProduct(r: ProductRow): Product {
  const variants = r.variants.map((v) => ({
    id: v.id,
    title: v.title,
    price: { amount: toEuros(v.price_cents), currencyCode: "EUR" as const },
    inventoryQuantity: v.stock_quantity,
    code: v.sku,
    isAvailable: isVariantAvailable(v),
  }));

  const first = r.variants[0];
  const amount = first ? toEuros(first.price_cents) : 0;
  const compareAt = first?.compare_at_price_cents ?? null;
  const onSale = compareAt != null && compareAt > (first?.price_cents ?? 0);

  const prices = r.variants.map((v) => v.price_cents);
  const minCents = prices.length ? Math.min(...prices) : 0;
  const maxCents = prices.length ? Math.max(...prices) : 0;
  const priceRange = minCents !== maxCents
    ? {
        min: { amount: toEuros(minCents), currencyCode: "EUR" as const },
        max: { amount: toEuros(maxCents), currencyCode: "EUR" as const },
      }
    : undefined;

  return {
    id: r.id,
    title: r.title,
    handle: r.slug,
    categoryHandle: r.category_slug ?? "",
    shortDescription: r.description ?? "",
    price: { amount, currencyCode: "EUR" },
    compareAtPrice: onSale ? { amount: toEuros(compareAt), currencyCode: "EUR" } : undefined,
    priceRange,
    badges: [
      ...(onSale ? (["sale"] as const) : []),
      ...(isNewArrival(r) ? (["new"] as const) : []),
    ],
    variants,
    placeholderTone: toneFor(r.slug),
    imageUrl: publicImageUrl(r.image_path),
    code: variants[0]?.code ?? null,
    isAvailable: variants.some((v) => v.isAvailable),
    characteristics: toCharacteristics(r),
  };
}

// The one product projection, reused by every query below. Variants come back
// as an aggregated JSON array rather than as joined rows, so a product with
// three variants is one row, not three — no client-side de-duplication.
const productFields = sql`
  p.id, p.slug, p.title, p.description, p.created_at, p.is_new_override,
  p.material, p.weight_grams, p.length_cm, p.width_cm, p.height_cm, p.origin_country,
  c.slug AS category_slug,
  (SELECT i.storage_path FROM shop.product_image i
    WHERE i.product_id = p.id ORDER BY i.position LIMIT 1) AS image_path,
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', v.id, 'title', v.title, 'sku', v.sku,
      'price_cents', v.price_cents,
      'compare_at_price_cents', v.compare_at_price_cents,
      'stock_quantity', v.stock_quantity,
      'allow_backorder', v.allow_backorder
    ) ORDER BY v.position, v.created_at)
    FROM shop.product_variant v WHERE v.product_id = p.id AND v.is_active
  ), '[]'::json) AS variants,
  (SELECT MIN(v.price_cents) FROM shop.product_variant v
    WHERE v.product_id = p.id AND v.is_active) AS min_price_cents
`;

export type ProductSort = "newest" | "title-asc" | "price-asc" | "price-desc";

// Whitelisted fragments — the sort value never reaches SQL as a string.
// Greek titles sort with the ICU el-GR collation (verified available on this
// database), not byte order, so "Άλφα" lands where a Greek reader expects.
function orderBy(sort: ProductSort) {
  switch (sort) {
    case "title-asc": return sql`ORDER BY p.title COLLATE "el-GR-x-icu" ASC`;
    case "price-asc": return sql`ORDER BY min_price_cents ASC NULLS LAST, p.title COLLATE "el-GR-x-icu"`;
    case "price-desc": return sql`ORDER BY min_price_cents DESC NULLS LAST, p.title COLLATE "el-GR-x-icu"`;
    default: return sql`ORDER BY p.created_at DESC`;
  }
}

/**
 * Products in a category, including its descendants — browsing "Κουζίνα"
 * must show everything filed under its subcategories too. A recursive CTE
 * does this in one query; the Medusa version needed a separate round trip to
 * resolve child category ids first, and only ever handled one level.
 */
export async function getProductsByCategorySlug(
  slug: string,
  opts: { sort?: ProductSort; limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  const { sort = "newest", limit = 24, offset = 0 } = opts;

  const rows = (await sql`
    WITH RECURSIVE tree AS (
      SELECT id FROM shop.category WHERE slug = ${slug} AND is_active
      UNION ALL
      SELECT c.id FROM shop.category c JOIN tree t ON c.parent_id = t.id WHERE c.is_active
    )
    SELECT ${productFields}, COUNT(*) OVER () AS total_count
      FROM shop.product p
      LEFT JOIN shop.category c ON c.id = p.category_id
     WHERE p.is_active AND p.category_id IN (SELECT id FROM tree)
     ${orderBy(sort)}
     LIMIT ${limit} OFFSET ${offset}
  `) as unknown as Array<ProductRow & { total_count: string }>;

  return {
    products: rows.map(toDomainProduct),
    count: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}

export type Collection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
};

// Active-only, public fields — the admin's own AdminCollection (lib/admin/
// taxonomy.ts) additionally carries sortOrder/isActive/productCount, which
// have no storefront-facing meaning.
export async function getCollectionBySlug(slug: string): Promise<Collection | undefined> {
  const rows = await sql<Collection[]>`
    SELECT id, slug, title, description
      FROM shop.collection
     WHERE slug = ${slug} AND is_active
     LIMIT 1
  `;
  return rows[0];
}

// Flat membership via product_collection — no category-style recursive tree,
// collections don't nest.
export async function getProductsByCollectionSlug(
  slug: string,
  opts: { sort?: ProductSort; limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  const { sort = "newest", limit = 24, offset = 0 } = opts;

  const rows = (await sql`
    SELECT ${productFields}, COUNT(*) OVER () AS total_count
      FROM shop.product p
      LEFT JOIN shop.category c ON c.id = p.category_id
      JOIN shop.product_collection pc ON pc.product_id = p.id
      JOIN shop.collection col ON col.id = pc.collection_id
     WHERE p.is_active AND col.slug = ${slug} AND col.is_active
     ${orderBy(sort)}
     LIMIT ${limit} OFFSET ${offset}
  `) as unknown as Array<ProductRow & { total_count: string }>;

  return {
    products: rows.map(toDomainProduct),
    count: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}

export async function getAllCollectionSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const rows = await sql<{ slug: string; updated_at: Date }[]>`
    SELECT slug, updated_at FROM shop.collection WHERE is_active ORDER BY slug`;
  return rows.map((r) => ({ slug: r.slug, updatedAt: new Date(r.updated_at).toISOString() }));
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const rows = (await sql`
    SELECT ${productFields}
      FROM shop.product p
      LEFT JOIN shop.category c ON c.id = p.category_id
     WHERE p.slug = ${slug} AND p.is_active
     LIMIT 1
  `) as unknown as ProductRow[];
  return rows[0] ? toDomainProduct(rows[0]) : undefined;
}

/**
 * New Arrivals: inside the rolling window OR flagged by the admin. Medusa
 * couldn't express this as a filter at all, so the old code fetched a
 * 200-product superset and filtered in JavaScript. Here it is a WHERE clause.
 */
export async function getNewArrivalsPaged(
  opts: { sort?: ProductSort; limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  const { sort = "newest", limit = 24, offset = 0 } = opts;

  const rows = (await sql`
    SELECT ${productFields}, COUNT(*) OVER () AS total_count
      FROM shop.product p
      LEFT JOIN shop.category c ON c.id = p.category_id
     WHERE p.is_active
       AND (p.is_new_override
            OR p.created_at >= now() - ${`${NEW_ARRIVAL_WINDOW_DAYS} days`}::interval)
     ${orderBy(sort)}
     LIMIT ${limit} OFFSET ${offset}
  `) as unknown as Array<ProductRow & { total_count: string }>;

  return {
    products: rows.map(toDomainProduct),
    count: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}

/**
 * "Recommended". There is still no order history, so this stays an honest
 * curated slice (alphabetical by default) rather than a fabricated
 * popularity ranking — the same decision the Medusa version documented.
 * Once real orders exist this becomes a genuine best-seller query.
 */
export async function getFeaturedProductsPaged(
  opts: { sort?: ProductSort; limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  const { sort = "title-asc", limit = 24, offset = 0 } = opts;

  const rows = (await sql`
    SELECT ${productFields}, COUNT(*) OVER () AS total_count
      FROM shop.product p
      LEFT JOIN shop.category c ON c.id = p.category_id
     WHERE p.is_active
     ${orderBy(sort)}
     LIMIT ${limit} OFFSET ${offset}
  `) as unknown as Array<ProductRow & { total_count: string }>;

  return {
    products: rows.map(toDomainProduct),
    count: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}

export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];

  const rows = (await sql`
    SELECT ${productFields}
      FROM shop.product p
      LEFT JOIN shop.category c ON c.id = p.category_id
     WHERE p.is_active AND p.slug = ANY(${slugs})
  `) as unknown as ProductRow[];

  // Callers (recently-viewed) rely on the requested order being preserved.
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return slugs.flatMap((s) => {
    const r = bySlug.get(s);
    return r ? [toDomainProduct(r)] : [];
  });
}

/**
 * Related products. Same-category is a real, honest signal; "customers also
 * bought" would be a fabricated one until order data exists (see CART_UX_SPEC
 * §12 and the identical reasoning already applied on the PDP).
 */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  if (!product.categoryHandle) return [];

  const rows = (await sql`
    SELECT ${productFields}
      FROM shop.product p
      LEFT JOIN shop.category c ON c.id = p.category_id
     WHERE p.is_active AND c.slug = ${product.categoryHandle} AND p.id <> ${product.id}
     ORDER BY p.created_at DESC
     LIMIT ${limit}
  `) as unknown as ProductRow[];

  return rows.map(toDomainProduct);
}

/**
 * Cart cross-sell: other products from the categories already represented in
 * the cart, excluding what's in it. The Medusa version needed four sequential
 * HTTP round trips (fetch cart products → resolve each category id → fetch
 * candidates); this is one query.
 */
export async function getCartCrossSell(cartProductSlugs: string[], limit = 4): Promise<Product[]> {
  if (cartProductSlugs.length === 0) return [];

  const rows = (await sql`
    SELECT ${productFields}
      FROM shop.product p
      LEFT JOIN shop.category c ON c.id = p.category_id
     WHERE p.is_active
       AND NOT (p.slug = ANY(${cartProductSlugs}))
       AND p.category_id IN (
         SELECT category_id FROM shop.product
          WHERE slug = ANY(${cartProductSlugs}) AND category_id IS NOT NULL)
     ORDER BY p.created_at DESC
     LIMIT ${limit}
  `) as unknown as ProductRow[];

  return rows.map(toDomainProduct);
}

/**
 * The full catalog for the in-process Greek search (lib/search.ts).
 *
 * Kept in-process deliberately: Postgres has neither `unaccent` nor `pg_trgm`
 * installed here, and its ILIKE is not accent-insensitive — which is exactly
 * why lib/search.ts exists (Greek customers type "σεντονια" for "Σεντόνια").
 * The difference from the Medusa version is the feed: one indexed query
 * instead of a 1000-product HTTP fetch with every field expanded.
 */
// Was fetched fresh — full catalog, `json_agg`'d variants and all — on
// every debounced keystroke in the header search box (searchProducts() in
// lib/data/products.ts calls this directly, no cache in between). Now
// cached: `unstable_cache` requires a JSON-serializable return, so the Map/
// Set that callers actually want are built (cheaply, in memory) from a
// plain-array cache payload rather than cached directly — a Map/Set would
// silently come back empty through JSON serialization.
const getCachedSearchCatalog = unstable_cache(
  async (): Promise<{
    products: Product[];
    categoryNames: Array<[string, string]>;
    boostedIds: string[];
  }> => {
    const rows = (await sql`
      SELECT ${productFields}, p.is_search_boosted, c.name AS category_name
        FROM shop.product p
        LEFT JOIN shop.category c ON c.id = p.category_id
       WHERE p.is_active AND NOT p.hide_from_search
    `) as unknown as Array<ProductRow & { is_search_boosted: boolean; category_name: string | null }>;

    const categoryNames: Array<[string, string]> = [];
    const boostedIds: string[] = [];
    for (const r of rows) {
      if (r.category_slug && r.category_name) categoryNames.push([r.category_slug, r.category_name]);
      if (r.is_search_boosted) boostedIds.push(r.id);
    }

    return { products: rows.map(toDomainProduct), categoryNames, boostedIds };
  },
  ["search-catalog"],
  { revalidate: 60, tags: [SEARCH_CACHE_TAG] }
);

export async function getSearchCatalog(): Promise<{
  products: Product[];
  categoryNamesBySlug: Map<string, string>;
  boosted: Set<string>;
}> {
  const cached = await getCachedSearchCatalog();
  return {
    products: cached.products,
    categoryNamesBySlug: new Map(cached.categoryNames),
    boosted: new Set(cached.boostedIds),
  };
}

export const getSearchSynonymGroups = unstable_cache(
  async (): Promise<string[][]> => {
    const rows = await sql<{ terms: string }[]>`SELECT terms FROM shop.search_synonym`;
    return rows.map((r) =>
      r.terms.split(",").map((t) => t.trim()).filter(Boolean)
    ).filter((g) => g.length > 1);
  },
  ["search-synonyms"],
  { revalidate: 60, tags: [SEARCH_CACHE_TAG] }
);

export async function getAllProductSlugs(): Promise<{ handle: string; updatedAt: string }[]> {
  const rows = await sql<{ slug: string; updated_at: Date }[]>`
    SELECT slug, updated_at FROM shop.product WHERE is_active ORDER BY slug`;
  return rows.map((r) => ({ handle: r.slug, updatedAt: new Date(r.updated_at).toISOString() }));
}
