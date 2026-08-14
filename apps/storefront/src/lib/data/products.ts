import {
  getAllProductSlugs,
  getCartCrossSell as dbGetCartCrossSell,
  getFeaturedProductsPaged as dbGetFeaturedProductsPaged,
  getNewArrivalsPaged as dbGetNewArrivalsPaged,
  getProductBySlug,
  getProductsByCategorySlug,
  getProductsBySlugs,
  getRelatedProducts as dbGetRelatedProducts,
  getSearchCatalog,
  getSearchSynonymGroups,
  toneFor,
} from "@/lib/db/catalog";
import { expandQueryWithSynonyms } from "@/lib/data/search-management";
import { buildSearchIndexEntry, rankSearchMatches } from "@/lib/search";
import type { Product } from "@/lib/types";
import type { ProductSort } from "@/lib/db/catalog";

/**
 * Product reads. Every function here keeps the exact signature it had when
 * this file spoke to Medusa's Store API — the query engine underneath changed
 * completely, the contract with the component layer did not. That is what
 * made this swap a data-layer change rather than a storefront rewrite.
 *
 * `handle` is still the word used in this layer's vocabulary (it is what the
 * URL segment is called throughout the app); in the database the column is
 * `slug`. The translation happens here and nowhere else.
 */

export { toneFor };
export type { ProductSort };

export async function getProductsByCategoryHandle(
  categoryHandle: string,
  opts: { sort?: ProductSort; limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  return getProductsByCategorySlug(categoryHandle, opts);
}

export async function getProductByHandle(handle: string): Promise<Product | undefined> {
  return getProductBySlug(handle);
}

export async function getNewArrivalsPaged(
  opts: { sort?: ProductSort; limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  return dbGetNewArrivalsPaged(opts);
}

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  const { products } = await dbGetNewArrivalsPaged({ limit });
  return products;
}

export async function getFeaturedProductsPaged(
  opts: { sort?: ProductSort; limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  return dbGetFeaturedProductsPaged(opts);
}

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  const { products } = await dbGetFeaturedProductsPaged({ limit });
  return products;
}

export async function getProductsByHandles(handles: string[]): Promise<Product[]> {
  return getProductsBySlugs(handles);
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  return dbGetRelatedProducts(product, limit);
}

export async function getCartCrossSell(cartProductHandles: string[], limit = 4): Promise<Product[]> {
  return dbGetCartCrossSell(cartProductHandles, limit);
}

/**
 * Greek-aware search. The ranking engine (lib/search.ts) is unchanged — it
 * never depended on Medusa, and it is still the right answer here: this
 * database has neither `unaccent` nor `pg_trgm`, and Postgres ILIKE is not
 * accent-insensitive, which is precisely the gap lib/search.ts closes.
 *
 * What did change is the feed: one indexed SQL query instead of fetching a
 * 1000-product superset over HTTP with every field expanded, on every search.
 */
export async function searchProducts(
  query: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ products: Product[]; count: number }> {
  const trimmed = query.trim();
  if (!trimmed) return { products: [], count: 0 };

  const { limit = 24, offset = 0 } = opts;
  const [{ products, categoryNamesBySlug, boosted }, synonymGroups] = await Promise.all([
    getSearchCatalog(),
    getSearchSynonymGroups(),
  ]);
  const queries = expandQueryWithSynonyms(trimmed, synonymGroups);

  const ranked = rankSearchMatches(
    queries,
    products.map((product) => {
      // Real Greek display names ("Τηγάνια"), not the Latin URL slug — the
      // slug would never match a Greek-language query.
      const categoryName = categoryNamesBySlug.get(product.categoryHandle);
      const entry = buildSearchIndexEntry({
        title: product.title,
        skus: product.variants.map((v) => v.code),
        categoryNames: categoryName ? [categoryName] : [],
      });
      return { entry, item: product, tieBreak: entry.normalizedTitle, isBoosted: boosted.has(product.id) };
    })
  );

  return { products: ranked.slice(offset, offset + limit), count: ranked.length };
}

export async function getAllProductHandles(): Promise<{ handle: string; updatedAt: string }[]> {
  return getAllProductSlugs();
}
