"use client";

import { SectionHeading } from "@/components/checkout/SectionHeading";
import { formatPrice } from "@/lib/format";
import { PICKUP_LOCATION } from "@/lib/pickup-config";
import type { ShippingOption } from "@/lib/types";

function ShippingOptionPrice({ price }: { price: ShippingOption["price"] }) {
  // A pickup/free option showing "0,00 €" reads like a pricing glitch, not
  // an intentional free method — "Δωρεάν" is the honest, deliberate label.
  if (price.amount === 0) return <span className="font-medium text-success">Δωρεάν</span>;
  return <span className="font-medium text-ink tabular-nums">{formatPrice(price)}</span>;
}

// Store Pickup has no address form, no locker search — just a location, its
// hours, and what happens next, per CHECKOUT_PREMIUM_SPEC.md §1's "keep the
// UX extremely simple" instruction. Shown only once the pickup option is
// actually selected, not always-visible clutter in the option list itself.
function PickupLocationInfo() {
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface px-4 py-3.5 text-sm">
      <div className="flex flex-col gap-1">
        <span className="font-medium text-ink">{PICKUP_LOCATION.name}</span>
        <span className="text-ink-muted">
          {PICKUP_LOCATION.addressLine}, {PICKUP_LOCATION.postalCode} {PICKUP_LOCATION.city}
        </span>
      </div>
      <dl className="flex flex-col gap-0.5">
        {PICKUP_LOCATION.hours.map(({ day, hours }) => (
          <div key={day} className="flex items-baseline justify-between gap-3 text-xs">
            <dt className="text-ink-muted">{day}</dt>
            <dd className="text-ink tabular-nums">{hours}</dd>
          </div>
        ))}
      </dl>
      <span className="text-xs text-ink-muted">{PICKUP_LOCATION.instructions}</span>
    </div>
  );
}

// Options are fetched live once the address is complete enough to resolve
// them (CHECKOUT_UX_SPEC.md §8) — never hardcoded. Real prices, real names.
// Selecting one saves it to the cart immediately so the order summary
// updates in place, not just on final submit.
export function ShippingSection({
  status,
  options,
  selectedId,
  onSelect,
  onRetry,
  saving,
}: {
  // "error" is distinct from "pending-address" on purpose: the address was
  // complete and valid, the save to the server just failed (a transient
  // issue, e.g. a database connection blip) — telling the customer to "fill
  // in your address" when they already did is actively misleading and was
  // the actual root cause of a real go-live bug report. See CheckoutForm's
  // attemptDetailsSave.
  status: "pending-address" | "loading" | "ready" | "empty" | "error";
  options: ShippingOption[];
  selectedId: string | null;
  onSelect: (option: ShippingOption) => void;
  onRetry?: () => void;
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

      {status === "error" && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-danger">
            Δεν μπορέσαμε να υπολογίσουμε τα μεταφορικά αυτή τη στιγμή. Δοκίμασε ξανά.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
            >
              Δοκίμασε ξανά
            </button>
          )}
        </div>
      )}

      {status === "ready" && (
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <div key={option.id} className="flex flex-col gap-2">
              <label
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
                <ShippingOptionPrice price={option.price} />
              </label>
              {option.isPickup && selectedId === option.id && <PickupLocationInfo />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
