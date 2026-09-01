"use client";

import { useEffect, useRef, useState } from "react";
import type { HomepageSection } from "@/lib/content-types";
import { HeroSlide } from "@/components/home/Hero";
import { ChevronDownIcon } from "@/components/ui/Icons";

// Same native CSS scroll-snap + native touch scrolling approach as
// ProductRail — no carousel library, real keyboard/touch scrolling, dot
// indicators track scroll position instead of driving it directly (so a
// user swiping never fights a controlled index).
export function HeroCarousel({
  slides,
  storeName,
  isFirstSection = false,
}: {
  slides: HomepageSection[];
  storeName: string;
  isFirstSection?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function updateActiveIndex() {
    const el = trackRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(Math.min(index, slides.length - 1));
  }

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateActiveIndex, { passive: true });
    window.addEventListener("resize", updateActiveIndex);
    return () => {
      el.removeEventListener("scroll", updateActiveIndex);
      window.removeEventListener("resize", updateActiveIndex);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  function scrollToIndex(index: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        tabIndex={0}
        aria-label="Κεντρικό banner — κύλιση με το πληκτρολόγιο ή αφή"
        className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto scroll-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4"
      >
        {slides.map((slide, i) => (
          <div key={slide.id} className="w-full flex-none snap-start">
            <HeroSlide content={slide} asH1={i === 0} storeName={storeName} isFirstSection={isFirstSection} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollToIndex(Math.max(activeIndex - 1, 0))}
        disabled={activeIndex === 0}
        aria-label="Προηγούμενο banner"
        className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-border bg-bg p-2.5 text-ink shadow-sm transition-opacity hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-0 md:flex"
      >
        <ChevronDownIcon className="h-5 w-5 rotate-90" />
      </button>
      <button
        type="button"
        onClick={() => scrollToIndex(Math.min(activeIndex + 1, slides.length - 1))}
        disabled={activeIndex === slides.length - 1}
        aria-label="Επόμενο banner"
        className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-border bg-bg p-2.5 text-ink shadow-sm transition-opacity hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-0 md:flex"
      >
        <ChevronDownIcon className="h-5 w-5 -rotate-90" />
      </button>

      <div className="mt-4 flex justify-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => scrollToIndex(i)}
            aria-label={`Μετάβαση στο banner ${i + 1}`}
            aria-current={i === activeIndex}
            className={`h-2 rounded-full transition-all ${i === activeIndex ? "w-6 bg-ink" : "w-2 bg-border"}`}
          />
        ))}
      </div>
    </div>
  );
}
