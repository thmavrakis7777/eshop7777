"use client";

import { useEffect } from "react";
import {
  rememberShoppingPage,
  rememberShoppingPosition,
  takeScrollRestore,
  type ShoppingPosition,
} from "@/lib/last-shopping-page";
import { instantScrollTo, stickyHeaderHeight } from "@/lib/instant-scroll";

const SAVE_EVERY_MS = 250;
// Infinite-scroll lists load 24 products a batch; 15 batches is 360
// products, far past any category today, and bounds the work if the saved
// card is gone (sold out, deactivated).
const MAX_BATCHES = 15;
const BATCH_WAIT_MS = 4000;

/**
 * Records the current page — and, as the shopper scrolls, how far down it
 * they are — as the place «Συνέχεια αγορών» returns to
 * (lib/last-shopping-page.ts). When the page was opened by that button, it
 * puts the shopper back where they were. Rendered by the product page and
 * every product listing. `signature` changes with the listing's filters and
 * sort, so the stored URL follows the shopper's latest choices.
 */
export function RememberShoppingPage({ signature }: { signature: string }) {
  useEffect(() => {
    const url = window.location.pathname + window.location.search;
    rememberShoppingPage(url);

    let restoring = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    function onScroll() {
      // A restore jumps around (down to the end to load more batches);
      // those positions are not the shopper's and must not be saved.
      if (restoring || timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        rememberShoppingPosition(url, currentPosition());
      }, SAVE_EVERY_MS);
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    // Save right away when the shopper clicks (a product, the cart) or
    // leaves the site — the page is still on screen then, and a scroll
    // within the last 250 ms would otherwise be lost.
    function saveNow() {
      if (restoring) return;
      if (timer) clearTimeout(timer);
      timer = undefined;
      rememberShoppingPosition(url, currentPosition());
    }
    window.addEventListener("click", saveNow, true);
    window.addEventListener("pagehide", saveNow);

    // One frame later, so the page is laid out before measuring — and the
    // mark is taken inside it, so an effect torn down and re-run first
    // (React does that in development) does not lose it.
    const frame = requestAnimationFrame(() => {
      const saved = takeScrollRestore(url);
      if (!saved) return;
      restoring = true;
      restorePosition(saved, () => cancelled).finally(() => {
        restoring = false;
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("click", saveNow, true);
      window.removeEventListener("pagehide", saveNow);
    };
  }, [signature]);
  return null;
}

function productLinks(): HTMLAnchorElement[] {
  const grid = document.querySelector("[data-product-grid]");
  return grid ? [...grid.querySelectorAll<HTMLAnchorElement>('a[href^="/proionta/"]')] : [];
}

function currentPosition(): ShoppingPosition {
  const position: ShoppingPosition = { y: Math.round(window.scrollY) };
  // The first card not hidden under the sticky header.
  const headerHeight = stickyHeaderHeight();
  const card = productLinks().find((a) => a.getBoundingClientRect().bottom > headerHeight);
  if (card) {
    position.anchor = { href: card.getAttribute("href")!, top: Math.round(card.getBoundingClientRect().top) };
  }
  return position;
}

async function restorePosition(saved: ShoppingPosition, isCancelled: () => boolean): Promise<void> {
  const findCard = () => (saved.anchor ? productLinks().find((a) => a.getAttribute("href") === saved.anchor!.href) : undefined);

  for (let batch = 0; batch < MAX_BATCHES && !isCancelled(); batch++) {
    const card = findCard();
    if (card) {
      alignCard(card, saved.anchor!.top);
      // Images above it may still be loading and move it; settle once more.
      await wait(400);
      const again = findCard();
      if (again && !isCancelled()) alignCard(again, saved.anchor!.top);
      return;
    }
    // A product page, or a listing without the card (yet): pixels.
    if (!saved.anchor || productLinks().length === 0) break;
    // The card is in a batch the list has not loaded again yet: go to the
    // end of the grid — where the list loads its next batch — and look
    // again. The end of the grid, not of the page: below it a category has
    // its «Συχνές Ερωτήσεις» and description, and jumping past them would
    // overshoot the point that triggers the load.
    const before = productLinks().length;
    const grid = document.querySelector("[data-product-grid]")!;
    instantScrollTo(grid.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 100);
    const grew = await waitFor(() => productLinks().length > before, BATCH_WAIT_MS);
    if (!grew) break;
  }
  if (!isCancelled()) instantScrollTo(saved.y);
}

function alignCard(card: HTMLElement, top: number) {
  instantScrollTo(card.getBoundingClientRect().top + window.scrollY - top);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (condition()) return true;
    await wait(100);
  }
  return condition();
}
