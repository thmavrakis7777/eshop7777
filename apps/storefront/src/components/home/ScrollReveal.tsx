"use client";

import { useEffect, useRef, type ReactNode } from "react";

// framer-motion's `viewport.amount: 0.2`: a section counts as in view once
// 20% of it is on screen.
const VISIBLE_AMOUNT = 0.2;

/**
 * Subtle fade + slide-up reveal for the homepage Hero and Promo (Editorial-
 * Banner) sections only — not a general-purpose primitive, so it stays this
 * small and un-abstracted on purpose. A plain wrapper rather than a change
 * to Hero/EditorialBanner themselves, so those stay server components and
 * every other homepage section (products, categories, guarantees,
 * newsletter, footer) is never touched by this.
 *
 * Same look and behaviour as the framer-motion version it replaced (Speed
 * audit SPD-11, which dropped framer-motion's 41 KB gzipped from the
 * homepage): 500 ms ease-out fade and 20 px slide-up once 20% is visible,
 * fading back out on the way past and in again on return (once: false, per
 * spec), and none of it under prefers-reduced-motion. The transition itself
 * is the `.scroll-reveal` rules in app/globals.css; this only flips
 * `data-reveal`, so a scroll never re-renders React. Only opacity/transform
 * change — compositor-only, so this can't introduce layout shift.
 *
 * One deliberate difference: the server HTML is never hidden. framer-motion
 * rendered `opacity:0` into the HTML, so anything on screen stayed invisible
 * until JavaScript ran (PERF-001). Here the hidden state is only ever set in
 * the browser, and only for a section that is completely off-screen when the
 * page loads — nobody can see it disappear. A section already on screen (or
 * peeking in at the bottom) simply stays visible instead of fading out and
 * back in. HomepageSectionGroup still doesn't wrap the section that opens
 * the page.
 */
export function ScrollReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let initial = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (initial) {
          initial = false;
          if (entry.intersectionRatio > 0) return;
        }
        el.dataset.reveal = entry.intersectionRatio >= VISIBLE_AMOUNT ? "shown" : "hidden";
      },
      { threshold: VISIBLE_AMOUNT }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="scroll-reveal">
      {children}
    </div>
  );
}
