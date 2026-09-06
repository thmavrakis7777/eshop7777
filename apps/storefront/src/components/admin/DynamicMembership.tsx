"use client";

import type { AdminVariant } from "@/lib/admin/products";
import { money } from "@/components/admin/ui/primitives";

/**
 * Explains WHY this product is (or is not) in SALES and NEW ARRIVALS.
 *
 * Deliberately read-only. A checkbox here would be a lie: membership is
 * derived from the variant prices and the creation date, so a control that
 * appeared to toggle it could only either do nothing or silently contradict
 * the numbers on the same screen. The one real control — "Σήμανση ως «Νέο»" —
 * lives above in Κατάσταση, where it belongs, and is referenced from here.
 *
 * The rules mirror SALE_PREDICATE and NEW_ARRIVAL_PREDICATE in
 * lib/db/catalog.ts. They are evaluated here only to EXPLAIN the state after
 * a save; the database remains the source of truth for what actually shows.
 * The window itself (`newArrivalWindowDays`) is passed in rather than
 * hardcoded, since it's admin-configurable — see AdminProductDetail.newArrivalWindowDays.
 */

function Row({
  active,
  title,
  reason,
}: {
  active: boolean;
  title: string;
  reason: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          active ? "bg-success/15 text-success" : "bg-surface-strong text-ink-muted"
        }`}
      >
        {active ? "✓" : "—"}
      </span>
      <span className="flex flex-col">
        <span className={`text-sm font-medium ${active ? "text-ink" : "text-ink-muted"}`}>
          {title}
          <span className="sr-only">{active ? ": ναι" : ": όχι"}</span>
        </span>
        <span className="text-xs text-ink-muted">{reason}</span>
      </span>
    </div>
  );
}

export function DynamicMembership({
  variants,
  ageDays,
  isNewOverride,
  newArrivalWindowDays,
}: {
  variants: AdminVariant[];
  ageDays: number;
  isNewOverride: boolean;
  newArrivalWindowDays: number;
}) {
  // Strictly greater: an equal compare-at price is a price that was never
  // reduced, not a 0% discount, and must not count as a sale.
  const discounted = variants.filter(
    (v) => v.isActive && v.compareAtPriceCents != null && v.compareAtPriceCents > v.priceCents
  );
  const onSale = discounted.length > 0;

  const best = discounted.reduce<{ pct: number; from: number; to: number } | null>((acc, v) => {
    const from = v.compareAtPriceCents as number;
    const pct = Math.round(((from - v.priceCents) / from) * 100);
    return acc && acc.pct >= pct ? acc : { pct, from, to: v.priceCents };
  }, null);

  const withinWindow = ageDays <= newArrivalWindowDays;
  const isNew = isNewOverride || withinWindow;

  return (
    <div className="flex flex-col gap-3">
      <Row
        active={onSale}
        title="ΠΡΟΣΦΟΡΕΣ"
        reason={
          onSale && best
            ? `${money(best.from)} → ${money(best.to)} (−${best.pct}%)`
            : "Καμία παραλλαγή δεν έχει τιμή προσφοράς χαμηλότερη από την κανονική."
        }
      />
      <Row
        active={isNew}
        title="ΝΕΕΣ ΑΦΙΞΕΙΣ"
        reason={
          isNewOverride
            ? "Σημασμένο χειροκίνητα ως «Νέο»."
            : withinWindow
              ? `Δημιουργήθηκε πριν ${ageDays} ${ageDays === 1 ? "ημέρα" : "ημέρες"} (όριο ${newArrivalWindowDays}).`
              : `Δημιουργήθηκε πριν ${ageDays} ημέρες — πάνω από το όριο των ${newArrivalWindowDays}.`
        }
      />

      <p className="border-t border-border pt-2.5 text-xs text-ink-muted">
        Υπολογίζονται αυτόματα και δεν ρυθμίζονται εδώ. Οι ΠΡΟΣΦΟΡΕΣ ακολουθούν τις τιμές των
        παραλλαγών· οι ΝΕΕΣ ΑΦΙΞΕΙΣ την ημερομηνία δημιουργίας ή τη σήμανση «Νέο» παραπάνω.
      </p>
    </div>
  );
}
