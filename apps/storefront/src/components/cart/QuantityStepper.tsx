"use client";

// "-" disables at 1 rather than decrementing to 0 — going to zero via minus
// is a bigger, easier-to-mis-tap action than adjusting quantity. Removal is
// the separate, deliberate "Αφαίρεση" control (CART_UX_SPEC.md §10).
export function QuantityStepper({
  quantity,
  productTitle,
  disabled,
  onChange,
}: {
  quantity: number;
  productTitle: string;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-sm border border-border" role="group" aria-label={`Ποσότητα για ${productTitle}`}>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-ink disabled:text-ink-muted/40"
        disabled={disabled || quantity <= 1}
        aria-label={`Μείωση ποσότητας για ${productTitle}`}
        onClick={() => onChange(quantity - 1)}
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
