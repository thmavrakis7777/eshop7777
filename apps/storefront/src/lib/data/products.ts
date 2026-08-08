import { getDefaultRegionId, medusaFetch, type MedusaProduct, type MedusaVariant } from "@/lib/medusa";
import { getCategoryIdByHandle, getCategoryIdsForHandle } from "@/lib/data/categories";
import type { Product, Tone } from "@/lib/types";

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

function isNewArrival(createdAt: string): boolean {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays <= NEW_ARRIVAL_WINDOW_DAYS;
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
      ...(isNewArrival(p.created_at) ? (["new"] as const) : []),
    ],
    variants,
    placeholderTone: toneFor(p.handle),
    code: variants[0]?.code ?? null,
    isAvailable: variants.some((v) => v.isAvailable),
  };
}

const PRODUCT_FIELDS =
  "id,title,handle,description,thumbnail,created_at,status," +
  "+variants.calculated_price,+variants.sku,+variants.inventory_quantity," +
  "+variants.manage_inventory,+variants.allow_backorder," +
  "+categories.handle,+categories.name";

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

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  const regionId = await getDefaultRegionId();
  const params = new URLSearchParams({
    region_id: regionId,
    fields: PRODUCT_FIELDS,
    order: "-created_at",
    limit: String(limit),
  });
  const { products } = await medusaFetch<{ products: MedusaProduct[] }>(
    `/store/products?${params.toString()}`,
    { next: { revalidate: 30 } }
  );
  return products.map(toDomainProduct);
}

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  // No order history exists yet, so there's no real "best sellers" signal —
  // showing a curated slice instead of fabricating a popularity ranking.
  // Revisit once real order data exists to sort by actual sales.
  const regionId = await getDefaultRegionId();
  const params = new URLSearchParams({
    region_id: regionId,
    fields: PRODUCT_FIELDS,
    order: "title",
    limit: String(limit),
  });
  const { products } = await medusaFetch<{ products: MedusaProduct[] }>(
    `/store/products?${params.toString()}`,
    { next: { revalidate: 30 } }
  );
  return products.map(toDomainProduct);
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

// Medusa's own `q` full-text search already indexes both product
// title/description *and* variant SKU — confirmed live against the real
// backend (exact SKU, partial SKU substring, and a Greek title word all
// matched correctly). No separate search index/service to build or keep in
// sync; this just calls the same Store API endpoint every other product
// list already uses, with `q` added.
export async function searchProducts(
  query: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  const trimmed = query.trim();
  if (!trimmed) return { products: [], count: 0 };

  const { limit = 24, offset = 0 } = opts;
  const regionId = await getDefaultRegionId();
  const params = new URLSearchParams({
    q: trimmed,
    region_id: regionId,
    fields: PRODUCT_FIELDS,
    limit: String(limit),
    offset: String(offset),
  });

  const { products, count } = await medusaFetch<{ products: MedusaProduct[]; count: number }>(
    `/store/products?${params.toString()}`,
    { next: { revalidate: 30 } }
  );

  return { products: products.map(toDomainProduct), count };
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
