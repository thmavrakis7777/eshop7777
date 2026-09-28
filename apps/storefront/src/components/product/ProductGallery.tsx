"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { GalleryImage } from "@/lib/data/products";

/**
 * The product page's photos: one large photo, thumbnails under it when
 * there is more than one, swipe between them on a phone.
 *
 * The stage is the same box ProductImage renders (square, rounded, cover),
 * so a product with a single photo looks exactly as before — only the
 * gentle zoom below is new.
 *
 * The effect, kept deliberately quiet: the photo under the cursor eases up
 * to 105% over 0.7 s, and switching photos crossfades. `group-hover` only
 * applies on devices that really hover (Tailwind v4 wraps it in
 * `@media (hover: hover)`), so a tap on a phone never leaves a photo stuck
 * zoomed, and `motion-safe`/`motion-reduce` leave it still for anyone who
 * asked their system for less motion.
 *
 * Every photo is stacked in the stage and faded in and out rather than
 * swapped, so switching never waits on a download. Thumbnails use the same
 * `sizes` as the stage on purpose: the browser picks the same file from the
 * same srcset, so a thumbnail costs no extra download and no extra image
 * resizing on the server.
 */
export function ProductGallery({
  images,
  title,
  sizes,
}: {
  images: GalleryImage[];
  title: string;
  sizes: string;
}) {
  const [active, setActive] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const count = images.length;

  function go(delta: number) {
    setActive((i) => (i + delta + count) % count);
  }

  return (
    <div>
      <div
        className="group relative aspect-square w-full overflow-hidden rounded-md"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchStart.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || count < 2) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          // A clear sideways swipe only — a mostly vertical drag is the page
          // scrolling and must stay that.
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(t.clientY - start.y)) go(dx < 0 ? 1 : -1);
        }}
      >
        {images.map((img, i) => (
          <div
            key={img.url}
            aria-hidden={i !== active}
            // `scale`, not `transform`: Tailwind v4's scale-* sets the
            // separate CSS `scale` property, so a transform transition
            // would leave the zoom snapping instead of easing.
            className={`absolute inset-0 [transition:opacity_500ms_ease-out,scale_700ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              i === active ? "opacity-100 motion-safe:group-hover:scale-[1.05]" : "pointer-events-none opacity-0"
            }`}
          >
            <Image
              src={img.url}
              alt={img.alt || title}
              fill
              sizes={sizes}
              // The first photo is the page's LCP element (Speed audit
              // PERF-007/SPD-03) — the rest load lazily behind it.
              preload={i === 0}
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Φωτογραφία ${i + 1} από ${count}`}
              aria-current={i === active ? "true" : undefined}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border transition-opacity duration-300 md:h-20 md:w-20 ${
                i === active ? "border-ink opacity-100" : "border-border opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={img.url} alt="" fill sizes={sizes} className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
