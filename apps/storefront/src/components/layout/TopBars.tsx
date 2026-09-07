"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Wraps AnnouncementBar + PromoBannerBar and measures their real combined
 * height into --topbars-height — the same ResizeObserver-into-CSS-variable
 * pattern Header.tsx already uses for --header-height. hero-viewport-fill
 * (globals.css) subtracts both, so the homepage's first Hero always fills
 * exactly what's left of the first viewport at any breakpoint, with
 * whatever the bars' real content/wrapping happens to be — no more guessing
 * a flat height that's only right for some window sizes and leaves either a
 * gap or a sliver of the next section peeking into the first screen at
 * others. Collapses to a real 0 when neither bar renders (both return null
 * when they have nothing to show), so no `.has-top-bars`-style conditional
 * class is needed on the caller's side.
 */
export function TopBars({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    function update() {
      document.documentElement.style.setProperty("--topbars-height", `${el!.getBoundingClientRect().height}px`);
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
