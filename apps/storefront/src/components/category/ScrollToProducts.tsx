"use client";

import { useEffect } from "react";
import { PRODUCTS_ANCHOR_ID, takeScrollToProductsMark } from "@/lib/scroll-to-products";

/**
 * After a filter change (lib/scroll-to-products.ts), brings the results bar
 * to the top of the screen. `signature` is the listing's path + filters +
 * sort, so the effect runs again for each new result, including when the
 * same component stays mounted across a client-side navigation.
 *
 * An instant jump, not the site's smooth scrolling (html has
 * scroll-behavior: smooth): a smooth scroll started while the new result is
 * still settling was cancelled on phones, leaving the page at the top
 * (confirmed live at 375 px, 25 Οκτ 2026). Smooth scrolling is switched off
 * for this one jump and restored after, which works in every browser —
 * `behavior: "instant"` is not understood by older Safari.
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
      const header = document.querySelector("header.sticky");
      const headerHeight = header ? header.getBoundingClientRect().height : 0;
      const margin = headerHeight ? headerHeight + 12 : parseFloat(getComputedStyle(anchor).scrollMarginTop) || 0;
      const top = anchor.getBoundingClientRect().top + window.scrollY - margin;
      const root = document.documentElement;
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, Math.max(0, top));
      root.style.scrollBehavior = previous;
    });
    return () => cancelAnimationFrame(frame);
  }, [signature]);
  return null;
}
