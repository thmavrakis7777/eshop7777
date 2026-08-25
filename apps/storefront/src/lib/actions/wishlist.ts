"use server";

import { getProductsByHandles } from "@/lib/data/products";
import { getCustomerId } from "@/lib/data/customer";
import { addWishlistItem, getWishlistHandles, mergeWishlistHandles, removeWishlistItem } from "@/lib/db/wishlist";
import type { Product } from "@/lib/types";

// Bridges the client-only wishlist list (localStorage) to real product
// data — same pattern as fetchRecentlyViewedProducts, since wishlist
// handles aren't known until the browser reads them.
export async function fetchWishlistProducts(handles: string[]): Promise<Product[]> {
  return getProductsByHandles(handles);
}

/** Logged-in customer's server-side wishlist, or [] for a guest. */
export async function getWishlistHandlesAction(): Promise<string[]> {
  const customerId = await getCustomerId();
  if (!customerId) return [];
  return getWishlistHandles(customerId);
}

/**
 * Logged-in only — WishlistProvider only calls this once isLoggedIn is
 * true; a guest keeps using toggleWishlistHandle (localStorage) directly.
 * `currentlySaved` comes from the client's own state so this doesn't need a
 * read-then-write round trip to know which way to toggle.
 */
export async function toggleWishlistItemAction(
  handle: string,
  currentlySaved: boolean
): Promise<{ ok: true; handles: string[] } | { ok: false }> {
  const customerId = await getCustomerId();
  if (!customerId) return { ok: false };

  if (currentlySaved) {
    await removeWishlistItem(customerId, handle);
  } else {
    await addWishlistItem(customerId, handle);
  }
  return { ok: true, handles: await getWishlistHandles(customerId) };
}

/**
 * Called client-side right after a successful login/register (Server
 * Actions can't read localStorage themselves) with the guest's handles.
 * Returns the merged set so the client can adopt it as the new source of
 * truth without a second round trip.
 */
export async function mergeWishlistOnLoginAction(guestHandles: string[]): Promise<string[]> {
  const customerId = await getCustomerId();
  if (!customerId) return guestHandles;
  return mergeWishlistHandles(customerId, guestHandles);
}
