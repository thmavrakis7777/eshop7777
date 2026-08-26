"use server";

import {
  getFeaturedProductsPaged,
  getNewArrivalsPaged,
  getSaleProductsPaged,
  getProductsByCategoryHandle,
  getProductsByCollectionHandle,
  searchProducts,
  type CategoryFilters,
  type ProductSort,
} from "@/lib/data/products";
import type { Product } from "@/lib/types";

// Thin per-listing-type wrappers around the existing data adapters, called
// directly from the infinite-scroll grid (InfiniteProductGrid) the same way
// lib/actions/search.ts and recently-viewed.ts are already called from
// Client Components for reads, not just mutations — same established
// pattern, just for "load the next batch" instead of "resolve these handles."
//
// Every Server Action is a publicly reachable endpoint regardless of what the
// UI ever sends — InfiniteProductGrid always passes PAGE_SIZE (24), but a
// direct call could pass anything. Clamp rather than trust.
const MAX_PAGE_SIZE = 100;
const clampLimit = (limit: number) => Math.min(Math.max(1, Math.trunc(limit) || 1), MAX_PAGE_SIZE);
const clampOffset = (offset: number) => Math.max(0, Math.trunc(offset) || 0);

export async function loadMoreCategoryProductsAction(
  categoryHandle: string,
  sort: ProductSort,
  offset: number,
  limit: number,
  filters?: CategoryFilters
): Promise<{ products: Product[]; count: number }> {
  return getProductsByCategoryHandle(categoryHandle, {
    sort,
    limit: clampLimit(limit),
    offset: clampOffset(offset),
    filters,
  });
}

export async function loadMoreCollectionProductsAction(
  collectionHandle: string,
  sort: ProductSort,
  offset: number,
  limit: number
): Promise<{ products: Product[]; count: number }> {
  return getProductsByCollectionHandle(collectionHandle, {
    sort,
    limit: clampLimit(limit),
    offset: clampOffset(offset),
  });
}

export async function loadMoreNewArrivalsAction(
  sort: ProductSort,
  offset: number,
  limit: number
): Promise<{ products: Product[]; count: number }> {
  return getNewArrivalsPaged({ sort, limit: clampLimit(limit), offset: clampOffset(offset) });
}

export async function loadMoreSaleProductsAction(
  sort: ProductSort,
  offset: number,
  limit: number
): Promise<{ products: Product[]; count: number }> {
  return getSaleProductsPaged({ sort, limit: clampLimit(limit), offset: clampOffset(offset) });
}

export async function loadMoreFeaturedProductsAction(
  sort: ProductSort,
  offset: number,
  limit: number
): Promise<{ products: Product[]; count: number }> {
  return getFeaturedProductsPaged({ sort, limit: clampLimit(limit), offset: clampOffset(offset) });
}

export async function loadMoreSearchProductsAction(
  query: string,
  offset: number,
  limit: number
): Promise<{ products: Product[]; count: number }> {
  return searchProducts(query, { offset: clampOffset(offset), limit: clampLimit(limit) });
}
