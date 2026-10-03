"use client";

import { useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/lib/data/products";

/**
 * Full-screen photo viewer, opened by tapping the product page's photo
 * (owner request, 2026-10-03: "like the other e-shops").
 *
 * A native modal <dialog>: the browser supplies the focus trap, Esc to
 * close, an inert page behind it and focus returned to the photo after —
 * no library, nothing added to the bundle beyond this file. The background
 * is the page's own white (owner's choice), so it reads as the same page
 * with the photo enlarged rather than a new dark screen.
 *
 * Photos load from their original file, not through next/image: the point
 * here is the most detail available, and an original is at most 1600 px
 * (prepare-photo.ts) — so it costs no image optimisation and is fetched
 * only when the viewer is open. The photos either side of the current one
 * load with it, so the next swipe doesn't wait.
 *
 * Zoom: on a phone, the browser's own pinch-zoom (a swipe is ignored while
 * zoomed or with two fingers down, so panning never flips the photo). With
 * a mouse, a click zooms 2× where clicked and the view follows the pointer;
 * a second click zooms back out.
 */
export function ProductLightbox({
  images,
  title,
  index,
  onIndexChange,
  onClose,
}: {
  images: GalleryImage[];
  title: string;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // Transform origin in % of the photo's box while zoomed; null = not zoomed.
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  // Read once on open. Safe in an initializer: the viewer only ever renders
  // in the browser, after a tap — never on the server.
  const [finePointer] = useState(() => window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  const count = images.length;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // A modal dialog doesn't stop the page behind it scrolling under a
    // wheel or a phone's overscroll.
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    // Deliberately no dialog.close() here: its "close" event arrives a
    // moment later and would shut a viewer that had just reopened (React's
    // dev double-run of effects did exactly that). Unmounting removes the
    // dialog, which the browser treats as closed.
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, []);

  // Every way out (×, Esc, a click beside the photo) goes through the
  // dialog's own close(), so the browser returns focus to the photo; its
  // "close" event then tells the parent.
  function requestClose() {
    dialogRef.current?.close();
  }

  function go(delta: number) {
    setZoom(null);
    onIndexChange((index + delta + count) % count);
  }

  function zoomOriginAt(e: React.MouseEvent<HTMLImageElement>) {
    // The wrapper, not the image: it keeps its unscaled size while the
    // image is zoomed, so the percentages stay true.
    const box = e.currentTarget.parentElement!.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - box.top) / box.height) * 100)),
    };
  }

  const nearby = new Set([index, (index + 1) % count, (index - 1 + count) % count]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Φωτογραφίες: ${title}`}
      // Fired after any close (Esc closes the dialog natively). Ignored if
      // the dialog is open again by then — a stale event, not a real close.
      onClose={() => {
        if (!dialogRef.current?.open) onClose();
      }}
      onKeyDown={(e) => {
        if (count < 2) return;
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-bg p-0 text-ink backdrop:bg-bg open:flex open:flex-col"
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <span className="text-sm tabular-nums text-ink-muted" aria-live="polite">
          {count > 1 ? `${index + 1} / ${count}` : ""}
        </span>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Κλείσιμο"
          className="flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none text-ink transition-colors hover:bg-surface"
        >
          ×
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4"
        // A click on the empty space around the photo closes, as in most
        // shops' viewers; a click on the photo itself is the zoom.
        onClick={(e) => {
          if (e.target === e.currentTarget) requestClose();
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchStart.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          // Pinch-zoomed by the browser: the finger is panning, not swiping.
          if (!start || count < 2 || (window.visualViewport?.scale ?? 1) > 1.01) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(t.clientY - start.y)) go(dx < 0 ? 1 : -1);
        }}
      >
        {images.map((img, i) =>
          nearby.has(i) ? (
            <div
              key={img.url}
              className={i === index ? "relative max-h-full max-w-full overflow-hidden" : "hidden"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the original file on purpose: full detail for zooming, no optimisation cost (see above). */}
              <img
                src={img.url}
                alt={i === index ? img.alt || title : ""}
                draggable={false}
                onClick={(e) => {
                  if (!finePointer) return;
                  setZoom(zoom ? null : zoomOriginAt(e));
                }}
                onMouseMove={(e) => {
                  if (zoom) setZoom(zoomOriginAt(e));
                }}
                style={
                  i === index && zoom
                    ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
                    : undefined
                }
                className={`block max-h-[calc(100dvh-5.5rem)] max-w-full object-contain transition-transform duration-300 ease-out motion-reduce:transition-none ${
                  finePointer ? (zoom ? "cursor-zoom-out" : "cursor-zoom-in") : ""
                }`}
              />
            </div>
          ) : null
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Προηγούμενη φωτογραφία"
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/90 text-2xl leading-none text-ink shadow-sm transition-colors hover:bg-surface md:left-6"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Επόμενη φωτογραφία"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/90 text-2xl leading-none text-ink shadow-sm transition-colors hover:bg-surface md:right-6"
            >
              ›
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
