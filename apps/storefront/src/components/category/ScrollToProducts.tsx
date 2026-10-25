"use client";

import { useEffect } from "react";
import { PRODUCTS_ANCHOR_ID, takeScrollToProductsMark } from "@/lib/scroll-to-products";
import { instantScrollTo, stickyHeaderHeight } from "@/lib/instant-scroll";

/**
 * After a filter change (lib/scroll-to-products.ts), brings the results bar
 * to the top of the screen. `signature` is the listing's path + filters +
 * sort, so the effect runs again for each new result, including when the
 * same component stays mounted across a client-side navigation.
 *
 * An instant jump (lib/instant-scroll.ts): the smooth one was cancelled on
 * phones, leaving the page at the top (confirmed live at 375 px).
 */
export function ScrollToProducts({ signature }: { signature: string }) {
  useEffect(() => {
    // One frame later, so the new result is laid out before measuring. The
    // mark is taken inside the frame, not before it: if this effect is torn
    // down and re-run first (React does that in development, and on a quick
    // second render), the cancelled frame must not have used it up.
    const frame = requestAnimationFrame(() => {
      if (!takeScrollToProductsMark()) return;
      const anchor = document.getElementById(PRODUCTS_ANCHOR_ID);
      if (!anchor) return;
      // Clear of the sticky header, measured rather than assumed: it is
      // 73 px on phones and tablets but 120–160 px on desktops, depending
      // on how many rows the category menu wraps to (measured live).
      const headerHeight = stickyHeaderHeight();
      const margin = headerHeight ? headerHeight + 12 : parseFloat(getComputedStyle(anchor).scrollMarginTop) || 0;
      instantScrollTo(anchor.getBoundingClientRect().top + window.scrollY - margin);
    });
    return () => cancelAnimationFrame(frame);
  }, [signature]);
  return null;
}
