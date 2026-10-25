"use client";

import { useEffect } from "react";
import { rememberShoppingPage } from "@/lib/last-shopping-page";

/**
 * Records the current page as the place «Συνέχεια αγορών» returns to
 * (lib/last-shopping-page.ts). Rendered by the product page and every
 * product listing. `signature` changes with the listing's filters and sort,
 * so the stored URL follows the shopper's latest choices on the same page.
 */
export function RememberShoppingPage({ signature }: { signature: string }) {
  useEffect(() => {
    rememberShoppingPage(window.location.pathname + window.location.search);
  }, [signature]);
  return null;
}
