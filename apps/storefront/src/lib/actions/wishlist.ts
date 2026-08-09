"use server";

import { getProductsByHandles } from "@/lib/data/products";
import type { Product } from "@/lib/types";

// Bridges the client-only wishlist list (localStorage) to real Medusa
// product data — same pattern as fetchRecentlyViewedProducts, since
// wishlist handles aren't known until the browser reads them.
export async function fetchWishlistProducts(handles: string[]): Promise<Product[]> {
  return getProductsByHandles(handles);
}
