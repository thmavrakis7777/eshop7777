"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const subscribeToLoad = (onLoad: () => void) => {
  window.addEventListener("load", onLoad);
  return () => window.removeEventListener("load", onLoad);
};
const pageHasLoaded = () => document.readyState === "complete";
// The server never knows — and hydration must match the server HTML, so the
// first browser render says "not yet" too; React re-renders straight after
// hydration if the page had in fact already finished loading.
const notYetOnTheServer = () => false;

/**
 * Holds back an off-screen homepage image until the first screen has
 * finished loading, so it can't compete with the opening Hero photo for a
 * slow phone's bandwidth.
 *
 * Native `loading="lazy"` isn't enough on its own here: Chrome counts
 * anything within 1250–2500 px of the screen as "near" and starts it as soon
 * as the page is first laid out. Under the full-height Hero that is the
 * category tiles, the product rail, the second Hero and the banner — about
 * 280 KB, all downloading alongside the one photo the visitor is actually
 * looking at. Measured on PageSpeed's mobile test (07 Οκτ 2026), whether
 * those finished before the Hero photo appeared was the whole difference
 * between a 90 and an 84 (LCP 3.6 s vs 4.5 s) on identical code.
 *
 * Renders an empty `placeholderClassName` box — the same box the image
 * occupies, so nothing moves — until either the window `load` event (first
 * screen done) or that box scrolling into view, whichever comes first; then
 * the real children, which still lazy-load natively from there. A visitor
 * who scrolls down before the page has loaded gets the image started at
 * once rather than waiting. Nothing looks different: before, the same box
 * sat empty for as long as the lazy image took to download.
 *
 * Only for images below the fold — never for one that can be the Largest
 * Contentful Paint, which must stay in the server HTML.
 */
export function AfterPageLoad({
  children,
  placeholderClassName,
}: {
  children: ReactNode;
  placeholderClassName: string;
}) {
  const loaded = useSyncExternalStore(subscribeToLoad, pageHasLoaded, notYetOnTheServer);
  const [inView, setInView] = useState(false);
  const placeholderRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = placeholderRef.current;
    if (loaded || !el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setInView(true);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded]);

  if (loaded || inView) return children;
  return <span ref={placeholderRef} aria-hidden="true" className={placeholderClassName} />;
}
