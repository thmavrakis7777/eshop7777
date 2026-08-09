// Shared by ProductCard and the PDP so "how do we word/color stock state"
// lives in exactly one place — driven by the same real `isAvailable` flag
// computed from live Medusa inventory in lib/data/products.ts, never
// hardcoded. `--color-success` already existed in the design system
// (globals.css) but had no real use yet until this.
export function StockStatus({ isAvailable, className = "" }: { isAvailable: boolean; className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-xs font-medium ${className}`}>
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${isAvailable ? "bg-success" : "bg-ink-muted"}`}
      />
      <span className={isAvailable ? "text-success" : "text-ink-muted"}>
        {isAvailable ? "Σε απόθεμα" : "Εξαντλήθηκε"}
      </span>
    </p>
  );
}
