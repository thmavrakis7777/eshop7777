"use client";

import { SectionHeading } from "@/components/checkout/SectionHeading";
import { formatPrice } from "@/lib/format";
import { PICKUP_LOCATION } from "@/lib/pickup-config";
import type { ShippingOption } from "@/lib/types";

// `option.price` is the method's own flat rate — it does not by itself know
// whether THIS cart already clears that method's free_over_cents (nationwide
// €79, or Heraklion's own configured threshold): computeTotals applies that
// waiver when the order total is charged, but the row was still showing the
// static rate right up until the customer selected it, which reads as
// "€2.50 charged" for a cart that was actually about to be charged nothing.
// `qualifiesFree` mirrors that same comparison here, from data the option
// already carries, purely for display — callers must pass `false` whenever
// the cart has an oversized/heavy line UNLESS the option is Heraklion's own
// method (computeTotals's surcharge branch takes priority over
// free_over_cents for every other method; Heraklion's threshold is the one
// deliberate exception and covers heavy/bulky items too — see cart.ts's
// computeTotals), or this would show "Δωρεάν" on a cart that is actually
// about to be charged a real heavy-item surcharge.
//
// `price` is likewise only the method's static rate, not necessarily what
// this cart would actually pay: an oversized cart's real charge is the
// highest single item's own cost (lib/shipping.ts), which can be higher
// than the flat rate — a real, previously-shipped bug where the row kept
// showing e.g. "3,00 €" for a method that would actually charge "12,00 €"
// the moment it was selected. Callers pass the real amount as
// `overrideAmount` whenever `qualifiesFree` is false and the cart has an
// oversized item, so the row always shows what selecting it would actually
// charge.
function ShippingOptionPrice({
  price,
  qualifiesFree,
  overrideAmount,
}: {
  price: ShippingOption["price"];
  qualifiesFree: boolean;
  overrideAmount?: number;
}) {
  // A pickup/free option showing "0,00 €" reads like a pricing glitch, not
  // an intentional free method — "Δωρεάν" is the honest, deliberate label.
  if (price.amount === 0 || qualifiesFree) return <span className="font-medium text-success">Δωρεάν</span>;
  const shown = overrideAmount != null ? { amount: overrideAmount, currencyCode: price.currencyCode } : price;
  return <span className="font-medium text-ink tabular-nums">{formatPrice(shown)}</span>;
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
// Deliberately names no location: whichever non-pickup option is currently
// relevant (Heraklion-only when that's what the address resolved to,
// otherwise the shared nationwide rate) already carries its own real
// free_over_cents, so this stays correct for both regimes without having to
// know which one it's looking at — and never risks showing "...στο
// Ηράκλειο" copy to a customer whose address isn't Heraklion.
function FreeShippingHint({ options, selectedId, subtotalAfterDiscountEur, hasOversizedItems }: {
  options: ShippingOption[];
  selectedId: string | null;
  subtotalAfterDiscountEur: number;
  hasOversizedItems: boolean;
}) {
  const relevant = options.find((o) => o.id === selectedId) ?? options.find((o) => !o.isPickup);
  if (!relevant || relevant.freeOverCents == null) return null;

  // An oversized/heavy line always charges its own real cost regardless of
  // subtotal (see computeTotals) — never claim "free shipping" over that.
  // Heraklion's own method is the one exception: its threshold covers
  // heavy/bulky items too, so this hint stays accurate for it.
  if (hasOversizedItems && !relevant.heraklionOnly) return null;

  const thresholdEur = relevant.freeOverCents / 100;
  if (subtotalAfterDiscountEur >= thresholdEur) {
    return <p className="text-xs font-medium text-success">Έχεις δωρεάν μεταφορικά!</p>;
  }
  const remaining = thresholdEur - subtotalAfterDiscountEur;
  return (
    <p className="text-xs text-ink-muted">
      Απομένουν <span className="font-medium text-ink">{formatPrice({ amount: remaining, currencyCode: "EUR" })}</span> για
      δωρεάν μεταφορικά.
    </p>
  );
}

export function ShippingSection({
  status,
  options,
  selectedId,
  onSelect,
  onRetry,
  saving,
  subtotalAfterDiscountEur,
  hasOversizedItems,
  oversizedFeeEur,
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
  subtotalAfterDiscountEur: number;
  // An oversized/heavy cart line always charges its own real shipping cost
  // (computeTotals in cart.ts) regardless of any free_over_cents threshold —
  // this suppresses every "Δωρεάν"/progress message in this section from
  // claiming otherwise while that's true, except for Heraklion's own method
  // (its threshold explicitly covers heavy/bulky items too).
  hasOversizedItems: boolean;
  // The real amount an oversized cart would be charged (lib/shipping.ts's
  // highestOversizedFeeCents) — 0 when hasOversizedItems is false. Passed
  // through to each option row so it never shows the method's flat rate
  // when the actual charge is higher.
  oversizedFeeEur: number;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading number={4} title="Τρόπος αποστολής" />
      {status === "ready" && (
        <FreeShippingHint
          options={options}
          selectedId={selectedId}
          subtotalAfterDiscountEur={subtotalAfterDiscountEur}
          hasOversizedItems={hasOversizedItems}
        />
      )}

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
          {options.map((option) => {
            const qualifiesFree =
              !option.isPickup &&
              (!hasOversizedItems || option.heraklionOnly) &&
              option.freeOverCents != null &&
              subtotalAfterDiscountEur >= option.freeOverCents / 100;
            // Mirrors computeTotals exactly: an oversized cart charges the
            // real oversized fee on every non-pickup option that doesn't
            // qualify free — including a below-threshold Heraklion option,
            // which still charges it (see cart.ts).
            const overrideAmount = !option.isPickup && hasOversizedItems && !qualifiesFree ? oversizedFeeEur : undefined;
            return (
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
                  <ShippingOptionPrice price={option.price} qualifiesFree={qualifiesFree} overrideAmount={overrideAmount} />
                </label>
                {option.isPickup && selectedId === option.id && <PickupLocationInfo />}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
