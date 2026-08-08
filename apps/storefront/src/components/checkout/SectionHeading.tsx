// Numbered section headers give orientation on the single scrolling
// checkout page without the overhead of an actual multi-step wizard
// (CHECKOUT_UX_SPEC.md §1/§3) — a real sequence, so the numbering encodes
// something true rather than decorating.
// `saving` is announced here rather than expressed by disabling the
// section's inputs. Disabling a field the customer has just tabbed into
// drops focus to <body> (confirmed live), so a background autosave would
// silently destroy their keyboard position mid-form.
export function SectionHeading({
  number,
  title,
  saving,
}: {
  number: number;
  title: string;
  saving?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-strong text-xs font-medium text-ink-muted tabular-nums">
        {number}
      </span>
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <span role="status" className="text-xs text-ink-muted">
        {saving ? "Αποθήκευση…" : ""}
      </span>
    </div>
  );
}
