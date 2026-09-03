"use client";

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
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={quantity}
          disabled={disabled}
          aria-label={`Ποσότητα για ${productTitle}`}
          className="h-11 w-14 border-x border-border bg-transparent text-center text-sm tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onChange={(e) => {
            const next = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(next) && next >= 1) onChange(next);
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
