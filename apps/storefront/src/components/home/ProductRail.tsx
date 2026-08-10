"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product/ProductCard";
import { ChevronDownIcon } from "@/components/ui/Icons";

// Native CSS scroll-snap + native touch scrolling — no carousel library.
// Desktop gets real, keyboard-operable arrow buttons that scroll the same
// track; mobile relies on native touch/swipe (the track itself stays
// natively focusable/scrollable via keyboard too). Reuses ProductCard
// unchanged — no second card design.
export function ProductRail({
  title,
  viewAllHref,
  products,
}: {
  title: string;
  viewAllHref?: string;
  products: Product[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  function updateEdges() {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= maxScroll - 1);
  }

  useEffect(() => {
    updateEdges();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [products]);

  function scrollByPage(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className="container-shell mt-16 md:mt-24">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl text-ink md:text-3xl">{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-sm font-medium text-accent hover:underline">
            Δες όλα →
          </Link>
        )}
      </div>

      <div className="relative mt-6">
        <div
          ref={trackRef}
          tabIndex={0}
          aria-label={`${title} — λίστα προϊόντων, κύλιση με το πληκτρολόγιο ή αφή`}
          className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4"
        >
          {products.map((p) => (
            <div key={p.id} className="w-[45%] flex-none snap-start sm:w-[31%] md:w-[23%] lg:w-[18.5%]">
              <ProductCard product={p} />
            </div>
          ))}
          {viewAllHref && (
            <div className="w-[45%] flex-none snap-start sm:w-[31%] md:w-[23%] lg:w-[18.5%]">
              <Link
                href={viewAllHref}
                className="group flex h-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border text-center transition-colors hover:border-accent hover:bg-surface"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-ink transition-colors group-hover:border-accent group-hover:text-accent"
                >
                  <ChevronDownIcon className="h-5 w-5 -rotate-90" />
                </span>
                <span className="px-4 text-sm font-medium text-ink group-hover:text-accent">
                  Δείτε Περισσότερα
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Desktop-only: mobile/touch relies on native swipe. Real disabled
            state (not just visual) so a keyboard/AT user can't trigger a
            no-op scroll past either end. */}
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          disabled={atStart}
          aria-label={`${title} — προηγούμενα προϊόντα`}
          className="absolute left-0 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-bg p-2.5 text-ink shadow-sm transition-opacity hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-0 md:flex"
        >
          <ChevronDownIcon className="h-5 w-5 rotate-90" />
        </button>
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          disabled={atEnd}
          aria-label={`${title} — επόμενα προϊόντα`}
          className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 rounded-full border border-border bg-bg p-2.5 text-ink shadow-sm transition-opacity hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-0 md:flex"
        >
          <ChevronDownIcon className="h-5 w-5 -rotate-90" />
        </button>
      </div>
    </section>
  );
}
