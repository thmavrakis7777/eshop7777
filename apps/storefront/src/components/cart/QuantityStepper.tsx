"use client";

import { useEffect, useRef, useState } from "react";

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
}) {
  const atMax = max != null && quantity >= max;
  const inputRef = useRef<HTMLInputElement>(null);
  // The input's own text, separate from the committed `quantity` prop — the
  // one reusable place every editable quantity field (Product Page, Cart
  // Page, Mini-Cart) gets the same typing behavior for free. A plain
  // `value={quantity}` would fight the customer mid-edit (e.g. briefly
  // empty while replacing "5" with "15", or a pasted "25kg" before it's
  // parsed) — this instead shows exactly what they typed, and only asks the
  // caller to accept it once it parses to a real number via onChange.
  const [draft, setDraft] = useState(String(quantity));
  useEffect(() => {
    // Re-sync from outside (+/- click, server confirmation, another tab)
    // — but never while the customer is actively typing in this field.
    if (document.activeElement !== inputRef.current) setDraft(String(quantity));
  }, [quantity]);

  return (
    <div className="inline-flex items-center rounded-sm border border-border" role="group" aria-label={`Ποσότητα για ${productTitle}`}>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-ink disabled:text-ink-muted/40"
        disabled={disabled || (quantity <= 1 && !onRemove)}
        aria-label={quantity <= 1 && onRemove ? `Αφαίρεση ${productTitle} από το καλάθι` : `Μείωση ποσότητας για ${productTitle}`}
        onClick={() => {
          if (quantity <= 1) {
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
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          step={1}
          value={draft}
          disabled={disabled}
          aria-label={`Ποσότητα για ${productTitle}`}
          className="h-11 w-14 border-x border-border bg-transparent text-center text-sm tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onChange={(e) => {
            setDraft(e.target.value);
            // Whole units only (CART_UX_SPEC's products are all sold that
            // way) — parseInt both rejects letters/empty (NaN) and truncates
            // an accidental decimal rather than erroring on it. Propagates
            // 0/negative too, same as an excessive number: the caller (not
            // this component) decides what "0" or "1000" means for it —
            // AddToCartButton disables Add; the cart commits 0/negative as a
            // removal, matching "-" at quantity 1. Never clamped to `max`
            // either, for the same reason: the global stock-limit feature
            // needs the caller to see the real typed number, not a swallowed
            // one.
            const next = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(next)) onChange(next);
          }}
          onBlur={() => {
            // Leftover invalid text (emptied the field, pasted letters) with
            // nothing valid ever having been typed after it — snap back to
            // the last real quantity instead of leaving the field blank.
            const next = Number.parseInt(draft, 10);
            if (!Number.isFinite(next) || next < 1) setDraft(String(quantity));
          }}
        />
      ) : (
        <span className="min-w-10 text-center text-sm tabular-nums text-ink" aria-live="polite">
          {quantity}
        </span>
      )}
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-ink disabled:text-ink-muted/40"
        disabled={disabled || atMax}
        aria-label={`Αύξηση ποσότητας για ${productTitle}`}
        onClick={() => onChange(quantity + 1)}
      >
        +
      </button>
    </div>
  );
}
