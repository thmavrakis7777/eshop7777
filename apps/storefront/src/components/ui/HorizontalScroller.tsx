"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/ui/Icons";

/**
 * A single horizontal row that scrolls instead of wrapping — the same
 * native-scroll-snap approach as ProductRail (no carousel library), but
 * taking server-rendered children, so only this scroll/arrow logic ships as
 * client JS and the cards themselves stay Server Components.
 *
 * Arrows are for mouse/trackpad users only (`pointer-fine:`), not for a
 * breakpoint: a phone or tablet swipes natively and gets no small buttons to
 * miss with a thumb, while a laptop or a narrow desktop window still gets
 * them at any width.
 *
 * Both arrows start hidden (`atStart` and `atEnd` both true) and appear only
 * once the track has been measured and there is actually something to
 * scroll to. So when every item fits — fewer categories, or a very wide
 * screen — no dead arrow ever shows, not even for a frame after hydration.
 * They are real `disabled` buttons, not just invisible, so keyboard and
 * screen-reader users can't trigger a no-op scroll past either end.
 */
export function HorizontalScroller({
  label,
  previousLabel,
  nextLabel,
  className = "",
  children,
}: {
  /** Accessible name for the scrollable region. */
  label: string;
  previousLabel: string;
  nextLabel: string;
  /** Extra classes for the track, e.g. full-bleed padding on small screens. */
  className?: string;
  children: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    function updateEdges() {
      const maxScroll = el!.scrollWidth - el!.clientWidth;
      setAtStart(el!.scrollLeft <= 1);
      setAtEnd(el!.scrollLeft >= maxScroll - 1);
    }
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    // ResizeObserver rather than a window resize listener: the track's own
    // width is what decides whether it overflows, and it can change without
    // the window resizing (scrollbar appearing, container width changing).
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      observer.disconnect();
    };
  }, []);

  function scrollByPage(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: reduceMotion ? "auto" : "smooth" });
  }

  const arrowClass =
    "absolute top-1/2 hidden -translate-y-1/2 rounded-full border border-border bg-bg p-2.5 text-ink shadow-sm transition-opacity hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-0 pointer-fine:flex";

  return (
    <div className="relative">
      <div
        ref={trackRef}
        role="region"
        tabIndex={0}
        aria-label={label}
        className={`scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 motion-safe:scroll-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4 ${className}`}
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        disabled={atStart}
        aria-label={previousLabel}
        className={`${arrowClass} left-0 -translate-x-1/2`}
      >
        <ChevronDownIcon className="h-5 w-5 rotate-90" />
      </button>
      <button
        type="button"
        onClick={() => scrollByPage(1)}
        disabled={atEnd}
        aria-label={nextLabel}
        className={`${arrowClass} right-0 translate-x-1/2`}
      >
        <ChevronDownIcon className="h-5 w-5 -rotate-90" />
      </button>
    </div>
  );
}
