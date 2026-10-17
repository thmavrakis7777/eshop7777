"use client";

import { useEffect, useRef, useState } from "react";
import { formatMetres, metresToSteps, minSteps, stepsToMetres, type LengthRule } from "@/lib/length";

// "-" at quantity 1 removes the line item (same action as the separate
// "Αφαίρεση" control) rather than decrementing to a meaningless 0 — an
// explicit product decision (2026-08-29), reversing the earlier "disabled at
// 1" design in CART_UX_SPEC.md §9. `onRemove` is optional so this same
// component also serves the Product Page's pre-add-to-cart selector, which
// has no line to remove — there, "-" just disables at quantity 1 instead.
export function QuantityStepper({
  quantity,
  productTitle,
  disabled,
  max,
  editable = false,
  onChange,
  onRemove,
  onMaxReached,
  length,
}: {
  quantity: number;
  productTitle: string;
  disabled?: boolean;
  // Visual ceiling only — the "+" button stops there. Deliberately does NOT
  // clamp `editable`'s manually-typed value: the global stock-limit feature
  // needs the caller to see (and react to) an excessive typed number, not
  // have it silently swallowed. Omitted = no cap (cart's existing behavior,
  // unchanged — the server is still the real limit either way).
  max?: number;
  // Product Page's quantity selector types a number directly; the cart's
  // stepper (drawer/cart page) stays display-only, exactly as before.
  editable?: boolean;
  onChange: (next: number) => void;
  onRemove?: () => void;
  // With this, "+" stays pressable at `max` and reports the press instead of
  // stepping past it — so the caller can show the stock notice to a shopper
  // who clicks for more, not only to one who types a bigger number
  // (owner decision, 2026-10-03: the quantity stays at the limit and Add to
  // cart keeps working). Without it, "+" simply disables at `max`.
  onMaxReached?: () => void;
  // Sold by length (LENGTH_SALES_SPEC.md): `quantity` counts steps, shown
  // and typed in metres («2,5 μ»); the floor is the product's minimum length
  // (1 μ = 2 steps), not 1 — "−" there removes the line (or disables, on
  // the product page), exactly as "−" at 1 does for a piece.
  length?: LengthRule;
}) {
  const atMax = max != null && quantity >= max;
  const floor = length ? minSteps(length) : 1;
  const atFloor = quantity <= floor;
  const noun = length ? "μήκους" : "ποσότητας";
  // What the field shows and accepts: steps as-is for pieces, metres for a
  // length product (2 steps of 0,5 μ → "1").
  const toText = (q: number) =>
    length ? stepsToMetres(q, length.stepCm).toLocaleString("el-GR", { maximumFractionDigits: 2 }) : String(q);
  const inputRef = useRef<HTMLInputElement>(null);
  // The input's own text, separate from the committed `quantity` prop — the
  // one reusable place every editable quantity field (Product Page, Cart
  // Page, Mini-Cart) gets the same typing behavior for free. A plain
  // `value={quantity}` would fight the customer mid-edit (e.g. briefly
  // empty while replacing "5" with "15", or a pasted "25kg" before it's
  // parsed) — this instead shows exactly what they typed, and only asks the
  // caller to accept it once it parses to a real number via onChange.
  const [draft, setDraft] = useState(toText(quantity));
  useEffect(() => {
    // Re-sync from outside (+/- click, server confirmation, another tab)
    // — but never while the customer is actively typing in this field.
    if (document.activeElement !== inputRef.current) setDraft(toText(quantity));
    // toText only changes with `length`, which a mounted stepper never swaps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity]);

  return (
    <div className="inline-flex items-center rounded-sm border border-border" role="group" aria-label={`${length ? "Μήκος" : "Ποσότητα"} για ${productTitle}`}>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-ink disabled:text-ink-muted/40"
        disabled={disabled || (atFloor && !onRemove)}
        aria-label={atFloor && onRemove ? `Αφαίρεση ${productTitle} από το καλάθι` : `Μείωση ${noun} για ${productTitle}`}
        onClick={() => {
          if (atFloor) {
            onRemove?.();
            return;
          }
          onChange(quantity - 1);
        }}
      >
        −
      </button>
      {editable ? (
        <input
          ref={inputRef}
          // A length is typed with a decimal comma («2,5»), which a
          // type="number" field rejects in some browsers — plain text there.
          type={length ? "text" : "number"}
          inputMode={length ? "decimal" : "numeric"}
          min={length ? undefined : 1}
          max={length ? undefined : max}
          step={length ? undefined : 1}
          value={draft}
          disabled={disabled}
          aria-label={length ? `Μήκος σε μέτρα για ${productTitle}` : `Ποσότητα για ${productTitle}`}
          className="h-11 w-14 border-x border-border bg-transparent text-center text-sm tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onChange={(e) => {
            // Editing buffer only — never commits mid-keystroke. Typing
            // "150" digit-by-digit used to call `onChange` (and, for the
            // cart's stepper, a server action) after every single digit; the
            // committed value now only moves on blur/Enter below, so a
            // customer typing a multi-digit quantity does it once, not N
            // times over.
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            // Funnels through the same commit path as blur rather than
            // duplicating it — Enter is just "commit now" instead of
            // "commit when focus leaves".
            if (e.key === "Enter") {
              e.preventDefault();
              inputRef.current?.blur();
            }
          }}
          onBlur={() => {
            // The one commit point for typed input. Whole units only
            // (CART_UX_SPEC's products are all sold that way) — parseInt
            // both rejects letters/empty (NaN) and truncates an accidental
            // decimal rather than erroring on it.
            // A length must be a whole number of steps (2,3 μ with 0,5 μ
            // steps isn't one) — snapped back like any other invalid text,
            // never rounded to a length the shopper didn't ask for.
            const parsed = length ? metresToSteps(draft, length.stepCm) : Number.parseInt(draft, 10);
            const next = parsed ?? Number.NaN;
            if (!Number.isFinite(next)) {
              // Leftover invalid text (emptied the field, pasted letters)
              // with nothing valid ever having been typed — snap back to
              // the last real quantity instead of leaving the field blank.
              setDraft(toText(quantity));
              return;
            }
            // Normalize the display (e.g. a typed "007" -> "7") independent
            // of whether the value actually changed.
            setDraft(toText(next));
            if (next === quantity) return;
            // Propagates 0/negative too, same as an excessive number: the
            // caller (not this component) decides what "0" or "1000" means
            // for it — AddToCartButton disables Add; the cart commits
            // 0/negative as a removal, matching "-" at quantity 1. Never
            // clamped to `max` either, for the same reason: the global
            // stock-limit feature needs the caller to see the real typed
            // number, not a swallowed one.
            onChange(next);
          }}
        />
      ) : (
        <span className="min-w-10 text-center text-sm tabular-nums text-ink" aria-live="polite">
          {length ? formatMetres(quantity, length.stepCm) : quantity}
        </span>
      )}
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-ink disabled:text-ink-muted/40"
        disabled={disabled || (atMax && !onMaxReached)}
        aria-label={`Αύξηση ${noun} για ${productTitle}`}
        onClick={() => {
          if (atMax) {
            onMaxReached?.();
            return;
          }
          onChange(quantity + 1);
        }}
      >
        +
      </button>
    </div>
  );
}

/**
 * Pairs with QuantityStepper's `onMaxReached`: `asked` is true once "+" was
 * pressed at the stock limit, and stays true only while the quantity is
 * still the one it was pressed at and still at the limit — any change, from
 * this control or anywhere else (another cart surface, a fresh stock
 * figure), clears it without a reset path of its own.
 */
export function useMaxReachedNotice(quantity: number, max: number | undefined) {
  const [askedAt, setAskedAt] = useState<number | null>(null);
  // Forgotten on the first change, not just hidden while it differs —
  // otherwise 3 → 2 → 3 would bring the notice back unasked.
  if (askedAt !== null && askedAt !== quantity) setAskedAt(null);
  return {
    asked: askedAt === quantity && max != null && quantity >= max,
    onMaxReached: () => setAskedAt(quantity),
  };
}
