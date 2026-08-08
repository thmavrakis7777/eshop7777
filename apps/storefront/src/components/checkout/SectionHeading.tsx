// Numbered section headers give orientation on the single scrolling
// checkout page without the overhead of an actual multi-step wizard
// (CHECKOUT_UX_SPEC.md §1/§3) — a real sequence, so the numbering encodes
// something true rather than decorating.
export function SectionHeading({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-strong text-xs font-medium text-ink-muted tabular-nums">
        {number}
      </span>
      <h2 className="font-display text-lg text-ink">{title}</h2>
    </div>
  );
}
