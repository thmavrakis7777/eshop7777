"use client";

import { useEffect } from "react";
import { PRODUCTS_ANCHOR_ID, takeScrollToProductsMark } from "@/lib/scroll-to-products";

/**
 * After a filter change (lib/scroll-to-products.ts), brings the results bar
 * to the top of the screen. `signature` is the listing's path + filters +
 * sort, so the effect runs again for each new result, including when the
 * same component stays mounted across a client-side navigation.
 */
export function ScrollToProducts({ signature }: { signature: string }) {
  useEffect(() => {
    if (!takeScrollToProductsMark()) return;
    document.getElementById(PRODUCTS_ANCHOR_ID)?.scrollIntoView({ block: "start" });
  }, [signature]);
  return null;
}
