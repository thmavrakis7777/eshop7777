"use server";

import {
  getFeaturedProductsPaged,
  getNewArrivalsPaged,
  getProductsByCategoryHandle,
  searchProducts,
  type ProductSort,
} from "@/lib/data/products";
import type { Product } from "@/lib/types";

// Thin per-listing-type wrappers around the existing data adapters, called
// directly from the infinite-scroll grid (InfiniteProductGrid) the same way
// lib/actions/search.ts and recently-viewed.ts are already called from
// Client Components for reads, not just mutations — same established
// pattern, just for "load the next batch" instead of "resolve these handles."

export async function loadMoreCategoryProductsAction(
  categoryHandle: string,
  sort: ProductSort,
  offset: number,
  limit: number
): Promise<{ products: Product[]; count: number }> {
  return getProductsByCategoryHandle(categoryHandle, { sort, limit, offset });
}

export async function loadMoreNewArrivalsAction(
  sort: ProductSort,
  offset: number,
  limit: number
): Promise<{ products: Product[]; count: number }> {
  return getNewArrivalsPaged({ sort, limit, offset });
}

export async function loadMoreFeaturedProductsAction(
  sort: ProductSort,
  offset: number,
  limit: number
): Promise<{ products: Product[]; count: number }> {
  return getFeaturedProductsPaged({ sort, limit, offset });
}

export async function loadMoreSearchProductsAction(
  query: string,
  offset: number,
  limit: number
): Promise<{ products: Product[]; count: number }> {
  return searchProducts(query, { offset, limit });
}
