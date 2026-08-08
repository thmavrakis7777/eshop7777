"use client";

import { SectionHeading } from "@/components/checkout/SectionHeading";
import { formatPrice } from "@/lib/format";
import type { ShippingOption } from "@/lib/types";

// Options are fetched live from Medusa once the address is complete enough
// to resolve them (CHECKOUT_UX_SPEC.md §8) — never hardcoded. Real prices,
// real names (translated to Greek presentation copy, not renamed in
// Medusa). Selecting one saves it to the cart immediately so the order
// summary updates in place, not just on final submit.
export function ShippingSection({
  status,
  options,
  selectedId,
  onSelect,
  saving,
}: {
  status: "pending-address" | "loading" | "ready" | "empty";
  options: ShippingOption[];
  selectedId: string | null;
  onSelect: (option: ShippingOption) => void;
  saving?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading number={4} title="Τρόπος αποστολής" />

      {status === "pending-address" && (
        <p className="text-sm text-ink-muted">Συμπλήρωσε τη διεύθυνσή σου για να δεις τις επιλογές αποστολής.</p>
      )}

      {status === "loading" && (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-sm bg-surface" />
          ))}
        </div>
      )}

      {status === "empty" && (
        <p role="alert" className="text-sm text-danger">
          Δεν είναι διαθέσιμη αποστολή για αυτή τη διεύθυνση. Επικοινώνησε μαζί μας.
        </p>
      )}

      {status === "ready" && (
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-sm border px-4 py-3.5 text-sm transition-colors ${
                selectedId === option.id ? "border-ink" : "border-border"
              } ${saving ? "opacity-60" : ""}`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="shipping-option"
                  checked={selectedId === option.id}
                  onChange={() => onSelect(option)}
                  disabled={saving}
                  className="h-4 w-4 accent-accent"
                />
                <span className="flex flex-col">
                  <span className="font-medium text-ink">{option.name}</span>
                  {option.deliveryEstimate && (
                    <span className="text-xs text-ink-muted">{option.deliveryEstimate}</span>
                  )}
                </span>
              </span>
              <span className="font-medium text-ink tabular-nums">{formatPrice(option.price)}</span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
