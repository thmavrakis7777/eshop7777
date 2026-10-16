"use client";

import Link from "next/link";
import type { ProductVariant } from "@/lib/types";

/**
 * The colour dots (COLOR_VARIANTS_SPEC.md) — small on the product card,
 * larger on the product page. A radio group for assistive tech: arrow keys
 * aren't wired, but each dot is a real button with its colour's name and
 * whether it's chosen, which is what a screen reader needs to pick one.
 *
 * A sold-out colour stays pickable (the page then offers «Ενημέρωσέ με»,
 * the card shows «Εξαντλήθηκε») and is struck through so it reads as
 * unavailable before anyone taps it.
 *
 * Light colours (white, silver) get a darker ring so they don't vanish on
 * the page background.
 */
export function ColourSwatches({
  colours,
  selectedId,
  onSelect,
  size,
  // Card only: past this many dots, the rest are summed up as «+N» linking
  // to the product page — a phone card is ~160px wide.
  maxVisible,
  moreHref,
}: {
  colours: ProductVariant[];
  selectedId: string;
  onSelect: (variant: ProductVariant) => void;
  size: "sm" | "md";
  maxVisible?: number;
  moreHref?: string;
}) {
  const overflow = maxVisible != null && colours.length > maxVisible;
  // Keep the chosen colour visible even when it's past the cut-off.
  const shown = overflow
    ? (() => {
        const head = colours.slice(0, maxVisible - 1);
        const chosen = colours.find((v) => v.id === selectedId);
        return chosen && !head.includes(chosen) ? [...head.slice(0, -1), chosen] : head;
      })()
    : colours;
  const hidden = colours.length - shown.length;

  // The card's dots share one line with «Κωδικός» (owner, 2026-10-16), so a
  // colour card is exactly as tall as every other card in its row. On a
  // phone (card ~160px, the code ~90px) four dots must fit in ~64px: 12px
  // dots, 16px apart, 16px from 640px up. Each button's tap area reaches
  // above and below its dot, and the negative margin keeps that reach from
  // making the line any taller than the code's own text (16px).
  // On the product page there is room: 32px dots in 40px tap areas.
  const sm = size === "sm";
  const dot = sm ? "h-3 w-3 sm:h-4 sm:w-4" : "h-8 w-8";
  const ring = sm
    ? "ring-[1.5px] ring-ink ring-offset-1 ring-offset-bg"
    : "ring-2 ring-ink ring-offset-2 ring-offset-bg";
  const hoverRing = sm
    ? "hover:ring-1 hover:ring-ink/40 hover:ring-offset-1 hover:ring-offset-bg"
    : "hover:ring-1 hover:ring-ink/40 hover:ring-offset-2 hover:ring-offset-bg";

  return (
    <div
      role="radiogroup"
      aria-label="Χρώμα"
      className={sm ? "-my-1 flex shrink-0 items-center sm:-my-1.5" : "-mx-1 flex flex-wrap items-center gap-1"}
    >
      {shown.map((v) => {
        const selected = v.id === selectedId;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={v.isAvailable ? v.title : `${v.title} — Εξαντλήθηκε`}
            title={v.isAvailable ? v.title : `${v.title} — Εξαντλήθηκε`}
            onClick={() => onSelect(v)}
            className={sm ? "rounded-full px-0.5 py-1.5 sm:px-1" : "rounded-full p-1"}
          >
            <span
              className={`relative block ${dot} rounded-full border transition-shadow ${
                isLight(v.swatchHex) ? "border-black/25" : "border-black/10"
              } ${selected ? ring : hoverRing}`}
              style={{ backgroundColor: v.swatchHex }}
            >
              {!v.isAvailable && (
                // A diagonal line across the dot: «sold out» without a word.
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-px w-[130%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-ink"
                />
              )}
            </span>
          </button>
        );
      })}
      {hidden > 0 && moreHref && (
        <Link href={moreHref} className="pl-0.5 text-xs text-ink-muted hover:text-ink" aria-label={`Άλλα ${hidden} χρώματα`}>
          +{hidden}
        </Link>
      )}
    </div>
  );
}

// Perceived brightness (ITU-R BT.601 weights) — above ~0.8 a dot needs the
// darker ring to stand off a near-white background.
function isLight(hex: string | undefined): boolean {
  if (!hex) return false;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.8;
}
