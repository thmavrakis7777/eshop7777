import { getDefaultRegionId, medusaFetch, type MedusaProduct, type MedusaVariant } from "@/lib/medusa";
import { getCategoryIdByHandle, getCategoryIdsForHandle } from "@/lib/data/categories";
import { buildSearchIndexEntry, rankSearchMatches, type SearchIndexEntry } from "@/lib/search";
import type { Product, ProductCharacteristics, Tone } from "@/lib/types";

// Small, deliberately incomplete lookup for the handful of manufacturing
// origins likely to appear on a Greek home-goods catalog — not a full
// ISO-3166 table. Falls back to the raw code so an unmapped country still
// displays something rather than nothing.
const COUNTRY_NAMES_EL: Record<string, string> = {
  gr: "Ελλάδα",
  it: "Ιταλία",
  de: "Γερμανία",
  fr: "Γαλλία",
  es: "Ισπανία",
  pt: "Πορτογαλία",
  nl: "Ολλανδία",
  tr: "Τουρκία",
  cn: "Κίνα",
  in: "Ινδία",
  pl: "Πολωνία",
  gb: "Ηνωμένο Βασίλειο",
};

const TONES: Tone[] = ["clay", "sage", "stone", "linen"];
const NEW_ARRIVAL_WINDOW_DAYS = 30;
// Native Medusa product tag value — admin-controlled override for New
// Arrivals membership (add/remove from the product's "Organize" panel in
// the admin, no code change needed). A product counts as a new arrival if
// it's within the rolling window below OR carries this tag, so genuinely
// new products need zero admin work while a curated older product can
// still be featured (or a very recent one suppressed by never tagging it
// and it'll simply age out of the window on its own).
export const NEW_ARRIVAL_TAG_VALUE = "new";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

export function toneFor(handle: string): Tone {
  return TONES[Math.abs(hash(handle)) % TONES.length];
}

function isWithinNewArrivalWindow(createdAt: string): boolean {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays <= NEW_ARRIVAL_WINDOW_DAYS;
}

function isNewArrivalMember(p: Pick<MedusaProduct, "created_at" | "tags">): boolean {
  return (
    isWithinNewArrivalWindow(p.created_at) ||
    p.tags.some((t) => t.value === NEW_ARRIVAL_TAG_VALUE)
  );
}

// A variant is purchasable unless Medusa is tracking its stock, backorders
// aren't allowed, and there's none left. Mirrors the exact rule Medusa's
// own cart/order completion enforces server-side — this is a UI-layer
// prediction of that rule, not a replacement for it (the real check still
// happens in the cart action; see CART_UX_SPEC.md/CHECKOUT_UX_SPEC.md for
// the reactive insufficient_inventory handling that stays in place either
// way).
function isVariantAvailable(v: MedusaVariant): boolean {
  if (!v.manage_inventory) return true;
  if (v.allow_backorder) return true;
  return (v.inventory_quantity ?? 0) > 0;
}

// Returns null (not an object with all-undefined fields) when nothing is
// populated, so PDP sections can do `if (characteristics)` once instead of
// checking every field. Confirmed live (2026-08-09): every real product
// returns null for all of these today — the section built on top of this
// will render nothing until real data is entered in the admin, which is
// the deliberate, approved behavior (see PRODUCT_CARD_WISHLIST_PDP_SPEC.md
// §4) rather than fabricated placeholder specs.
function toDomainCharacteristics(p: MedusaProduct): ProductCharacteristics | null {
  const c: ProductCharacteristics = {
    ...(p.material ? { material: p.material } : {}),
    ...(p.weight != null ? { weightGrams: p.weight } : {}),
    ...(p.length != null ? { lengthCm: p.length } : {}),
    ...(p.width != null ? { widthCm: p.width } : {}),
    ...(p.height != null ? { heightCm: p.height } : {}),
    ...(p.origin_country ? { originCountry: COUNTRY_NAMES_EL[p.origin_country.toLowerCase()] ?? p.origin_country } : {}),
  };
  return Object.keys(c).length > 0 ? c : null;
}

function toDomainProduct(p: MedusaProduct): Product {
  const variant = p.variants[0];
  const price = variant?.calculated_price;
  const amount = price?.calculated_amount ?? 0;
  const originalAmount = price?.original_amount ?? amount;
  const onSale = originalAmount > amount;

  const variants = p.variants.map((v) => ({
    id: v.id,
    title: v.title,
    price: { amount: v.calculated_price?.calculated_amount ?? 0, currencyCode: "EUR" as const },
    inventoryQuantity: v.inventory_quantity ?? 0,
    code: v.sku,
    isAvailable: isVariantAvailable(v),
  }));

  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    categoryHandle: p.categories[0]?.handle ?? "",
    shortDescription: p.description ?? "",
    price: { amount, currencyCode: "EUR" },
    compareAtPrice: onSale ? { amount: originalAmount, currencyCode: "EUR" } : undefined,
    badges: [
      ...(onSale ? (["sale"] as const) : []),
      ...(isNewArrivalMember(p) ? (["new"] as const) : []),
    ],
    variants,
    placeholderTone: toneFor(p.handle),
    imageUrl: p.thumbnail,
    code: variants[0]?.code ?? null,
    isAvailable: variants.some((v) => v.isAvailable),
    characteristics: toDomainCharacteristics(p),
  };
}

const PRODUCT_FIELDS =
  "id,title,handle,description,thumbnail,created_at,status," +
  "material,weight,length,width,height,origin_country," +
  "+variants.calculated_price,+variants.sku,+variants.inventory_quantity," +
  "+variants.manage_inventory,+variants.allow_backorder," +
  "+categories.handle,+categories.name,+tags.value";

export type ProductSort = "newest" | "title-asc" | "price-asc" | "price-desc";

export async function getProductsByCategoryHandle(
  categoryHandle: string,
  opts: { sort?: ProductSort; limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  const [categoryIds, regionId] = await Promise.all([
    getCategoryIdsForHandle(categoryHandle),
    getDefaultRegionId(),
  ]);
  if (categoryIds.length === 0) return { products: [], count: 0 };

  const { sort = "newest", limit = 24, offset = 0 } = opts;
  // The Store API can only order by real columns (created_at, title), not
  // calculated prices — price sorting is done client-side below. Fine at
  // today's catalog size; revisit if the catalog grows past a page or two.
  const order = sort === "title-asc" ? "title" : "-created_at";
  const wantsPriceSort = sort === "price-asc" || sort === "price-desc";

  const params = new URLSearchParams({
    region_id: regionId,
    fields: PRODUCT_FIELDS,
    order,
    limit: String(wantsPriceSort ? 200 : limit),
    offset: String(wantsPriceSort ? 0 : offset),
  });
  categoryIds.forEach((id) => params.append("category_id[]", id));

  const { products, count } = await medusaFetch<{ products: MedusaProduct[]; count: number }>(
    `/store/products?${params.toString()}`,
    { next: { revalidate: 30 } }
  );

  let domainProducts = products.map(toDomainProduct);

  if (sort === "price-asc") domainProducts = domainProducts.sort((a, b) => a.price.amount - b.price.amount);
  if (sort === "price-desc") domainProducts = domainProducts.sort((a, b) => b.price.amount - a.price.amount);
  if (wantsPriceSort) domainProducts = domainProducts.slice(offset, offset + limit);

  return { products: domainProducts, count };
}

export async function getProductByHandle(handle: string): Promise<Product | undefined> {
  const regionId = await getDefaultRegionId();
  const params = new URLSearchParams({
    handle,
    region_id: regionId,
    fields: PRODUCT_FIELDS,
  });
  const { products } = await medusaFetch<{ products: MedusaProduct[] }>(
    `/store/products?${params.toString()}`,
    { next: { revalidate: 30 } }
  );
  return products[0] ? toDomainProduct(products[0]) : undefined;
}

// New Arrivals membership isn't a single Medusa filter (rolling date window
// OR an admin tag) and isn't sortable by price server-side either — same
// constraint getProductsByCategoryHandle already works around for price
// sort. At today's catalog size (a few dozen products), fetching a
// generous superset ordered by -created_at, filtering/sorting/paginating
// in-process is far lighter than a second query strategy; revisit only if
// the catalog grows into the hundreds (same caveat as price sort above and
// getSearchCatalog).
const NEW_ARRIVAL_CANDIDATE_LIMIT = 200;

export async function getNewArrivalsPaged(
  opts: { sort?: ProductSort; limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  const { sort = "newest", limit = 24, offset = 0 } = opts;
  const regionId = await getDefaultRegionId();
  const params = new URLSearchParams({
    region_id: regionId,
    fields: PRODUCT_FIELDS,
    order: "-created_at",
    limit: String(NEW_ARRIVAL_CANDIDATE_LIMIT),
  });
  const { products } = await medusaFetch<{ products: MedusaProduct[] }>(
    `/store/products?${params.toString()}`,
    { next: { revalidate: 30 } }
  );

  let members = products.filter(isNewArrivalMember).map(toDomainProduct);

  if (sort === "title-asc") members = members.sort((a, b) => a.title.localeCompare(b.title, "el"));
  if (sort === "price-asc") members = members.sort((a, b) => a.price.amount - b.price.amount);
  if (sort === "price-desc") members = members.sort((a, b) => b.price.amount - a.price.amount);
  // sort === "newest": already in -created_at order from the API.

  return { products: members.slice(offset, offset + limit), count: members.length };
}

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  const { products } = await getNewArrivalsPaged({ limit });
  return products;
}

// No order history exists yet, so there's no real "best sellers" signal —
// "Recommended" is an honest curated slice (alphabetical by default), not a
// fabricated popularity ranking. Revisit the default order once real order
// data exists to sort by actual sales. Same offset/limit + client-side price
// sort pattern as getProductsByCategoryHandle.
export async function getFeaturedProductsPaged(
  opts: { sort?: ProductSort; limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  const { sort = "title-asc", limit = 24, offset = 0 } = opts;
  const regionId = await getDefaultRegionId();
  const order = sort === "newest" ? "-created_at" : "title";
  const wantsPriceSort = sort === "price-asc" || sort === "price-desc";

  const params = new URLSearchParams({
    region_id: regionId,
    fields: PRODUCT_FIELDS,
    order,
    limit: String(wantsPriceSort ? 200 : limit),
    offset: String(wantsPriceSort ? 0 : offset),
  });

  const { products, count } = await medusaFetch<{ products: MedusaProduct[]; count: number }>(
    `/store/products?${params.toString()}`,
    { next: { revalidate: 30 } }
  );

  let domainProducts = products.map(toDomainProduct);
  if (sort === "price-asc") domainProducts = domainProducts.sort((a, b) => a.price.amount - b.price.amount);
  if (sort === "price-desc") domainProducts = domainProducts.sort((a, b) => b.price.amount - a.price.amount);
  if (wantsPriceSort) domainProducts = domainProducts.slice(offset, offset + limit);

  return { products: domainProducts, count };
}

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  const { products } = await getFeaturedProductsPaged({ limit });
  return products;
}

export async function getProductsByHandles(handles: string[]): Promise<Product[]> {
  if (handles.length === 0) return [];
  const regionId = await getDefaultRegionId();
  const params = new URLSearchParams({ region_id: regionId, fields: PRODUCT_FIELDS });
  handles.forEach((h) => params.append("handle[]", h));

  const { products } = await medusaFetch<{ products: MedusaProduct[] }>(
    `/store/products?${params.toString()}`,
    { next: { revalidate: 30 } }
  );

  // Medusa doesn't guarantee response order matches the requested handle
  // order — re-sort to match, since callers (recently-viewed) rely on it
  // being most-recent-first.
  const byHandle = new Map(products.map((p) => [p.handle, p]));
  return handles.flatMap((h) => {
    const p = byHandle.get(h);
    return p ? [toDomainProduct(p)] : [];
  });
}

// No order history exists yet, so there's no real "frequently bought
// together" signal to show — that would be fabricating a trust/relevance
// claim the same way a fake bestseller label or star rating would (see
// "UX decisions" in PROJECT_MEMORY.md). Same-category is a real, honest
// substitute until actual order data exists to compute real co-purchase
// pairs.
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  if (!product.categoryHandle) return [];
  const [categoryId, regionId] = await Promise.all([
    getCategoryIdByHandle(product.categoryHandle),
    getDefaultRegionId(),
  ]);
  if (!categoryId) return [];

  const params = new URLSearchParams({
    region_id: regionId,
    fields: PRODUCT_FIELDS,
    order: "-created_at",
    limit: String(limit + 1),
  });
  params.append("category_id[]", categoryId);

  const { products } = await medusaFetch<{ products: MedusaProduct[] }>(
    `/store/products?${params.toString()}`,
    { next: { revalidate: 30 } }
  );

  return products
    .filter((p) => p.id !== product.id)
    .slice(0, limit)
    .map(toDomainProduct);
}

// Same honest signal as getRelatedProducts (same-category, real, not a
// fabricated "customers also bought" claim — see CART_UX_SPEC.md §12 and
// the identical reasoning already applied to PDP related products): here
// scoped to the categories actually represented in the cart, excluding
// products already in it.
export async function getCartCrossSell(cartProductHandles: string[], limit = 4): Promise<Product[]> {
  if (cartProductHandles.length === 0) return [];

  const cartProducts = await getProductsByHandles(cartProductHandles);
  const categoryHandles = [...new Set(cartProducts.map((p) => p.categoryHandle).filter(Boolean))];
  if (categoryHandles.length === 0) return [];

  const [regionId, categoryIds] = await Promise.all([
    getDefaultRegionId(),
    Promise.all(categoryHandles.map(getCategoryIdByHandle)),
  ]);
  const resolvedCategoryIds = categoryIds.filter((id): id is string => Boolean(id));
  if (resolvedCategoryIds.length === 0) return [];

  const params = new URLSearchParams({
    region_id: regionId,
    fields: PRODUCT_FIELDS,
    order: "-created_at",
    limit: String(limit + cartProductHandles.length),
  });
  resolvedCategoryIds.forEach((id) => params.append("category_id[]", id));

  const { products } = await medusaFetch<{ products: MedusaProduct[] }>(
    `/store/products?${params.toString()}`,
    { next: { revalidate: 30 } }
  );

  return products
    .filter((p) => !cartProductHandles.includes(p.handle))
    .slice(0, limit)
    .map(toDomainProduct);
}

// Medusa's own `q` param is a database-level ILIKE match: case-insensitive
// but not accent-insensitive, no fuzzy tolerance, and no controllable
// ranking — insufficient for Greek search, where customers routinely type
// without tonos ("σεντονια" for "Σεντόνια"). At today's catalog size (a
// couple dozen products), fetching the full catalog once per short cache
// window and ranking in-process (lib/search.ts) is far lighter than adding
// a database extension or an external search service — revisit only if the
// catalog grows into the hundreds. This is the one search implementation
// used by both this results page and the header's live dropdown (see
// lib/actions/search.ts) — no second, independent search path.
async function getSearchCatalog(): Promise<Array<{ product: Product; entry: SearchIndexEntry }>> {
  const regionId = await getDefaultRegionId();
  const params = new URLSearchParams({
    region_id: regionId,
    fields: PRODUCT_FIELDS,
    limit: "1000",
  });
  const { products } = await medusaFetch<{ products: MedusaProduct[] }>(
    `/store/products?${params.toString()}`,
    { next: { revalidate: 30 } }
  );

  return products.map((p) => ({
    product: toDomainProduct(p),
    // Real Greek display names (e.g. "Τηγάνια"), not the Latin URL handle —
    // the handle would never match a Greek-language query.
    entry: buildSearchIndexEntry({
      title: p.title,
      skus: p.variants.map((v) => v.sku),
      categoryNames: p.categories.map((c) => c.name),
    }),
  }));
}

export async function searchProducts(
  query: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  const trimmed = query.trim();
  if (!trimmed) return { products: [], count: 0 };

  const { limit = 24, offset = 0 } = opts;
  const catalog = await getSearchCatalog();

  const ranked = rankSearchMatches(
    trimmed,
    catalog.map(({ product, entry }) => ({ entry, item: product, tieBreak: entry.normalizedTitle }))
  );

  return { products: ranked.slice(offset, offset + limit), count: ranked.length };
}

export async function getAllProductHandles(): Promise<{ handle: string; updatedAt: string }[]> {
  const regionId = await getDefaultRegionId();
  const params = new URLSearchParams({
    region_id: regionId,
    fields: "handle,updated_at",
    limit: "1000",
  });
  const { products } = await medusaFetch<{ products: Array<{ handle: string; updated_at: string }> }>(
    `/store/products?${params.toString()}`,
    { next: { revalidate: 300 } }
  );
  return products.map((p) => ({ handle: p.handle, updatedAt: p.updated_at }));
}
