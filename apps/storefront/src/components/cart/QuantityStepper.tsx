"use client";

// "-" at quantity 1 removes the line item (same action as the separate
// "Αφαίρεση" control) rather than decrementing to a meaningless 0 — an
// explicit product decision (2026-08-29), reversing the earlier "disabled at
// 1" design in CART_UX_SPEC.md §9.
export function QuantityStepper({
  quantity,
  productTitle,
  disabled,
  onChange,
  onRemove,
}: {
  quantity: number;
  productTitle: string;
  disabled?: boolean;
  onChange: (next: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="inline-flex items-center rounded-sm border border-border" role="group" aria-label={`Ποσότητα για ${productTitle}`}>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-ink disabled:text-ink-muted/40"
        disabled={disabled}
        aria-label={quantity <= 1 ? `Αφαίρεση ${productTitle} από το καλάθι` : `Μείωση ποσότητας για ${productTitle}`}
        onClick={() => (quantity <= 1 ? onRemove() : onChange(quantity - 1))}
      >
        −
      </button>
      <span className="min-w-10 text-center text-sm tabular-nums text-ink" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-ink disabled:text-ink-muted/40"
        disabled={disabled}
        aria-label={`Αύξηση ποσότητας για ${productTitle}`}
        onClick={() => onChange(quantity + 1)}
      >
        +
      </button>
    </div>
  );
}
