"use server";

import { getProductsByHandles } from "@/lib/data/products";
import type { Product } from "@/lib/types";

// Bridges the client-only recently-viewed list (localStorage) to real
// Medusa product data — recently-viewed handles can't be resolved in a
// Server Component since they're not known until the browser reads them.
export async function fetchRecentlyViewedProducts(handles: string[]): Promise<Product[]> {
  return getProductsByHandles(handles);
}
