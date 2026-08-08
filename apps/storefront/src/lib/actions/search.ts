"use server";

import { searchProducts } from "@/lib/data/products";
import type { Product } from "@/lib/types";

const PREVIEW_LIMIT = 6;

// Backs the header's live-search dropdown — small, fast preview only. The
// full results page (/anazitisi) calls searchProducts directly as a Server
// Component, same pattern as every other product list in the app.
export async function searchProductsPreviewAction(query: string): Promise<Product[]> {
  const { products } = await searchProducts(query, { limit: PREVIEW_LIMIT });
  return products;
}
