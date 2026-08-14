import { SectionHeading } from "@/components/checkout/SectionHeading";
import type { PaymentProvider } from "@/lib/types";

// Driven by the payment-provider list, not hardcoded at the call site.
// Exactly one method exists today, presented honestly as "Αντικαταβολή"
// (explicit decision, see CHECKOUT_UX_SPEC.md §0.3) rather than implying
// card/wallet support that doesn't exist. A second real provider later just
// appears as another card.
//
// The id is `cod` now, not Medusa's `pp_system_default` — that string was a
// Medusa internal ("system default payment provider"), and keeping a
// vendor's identifier for cash on delivery after removing the vendor is
// exactly the debris this migration exists to avoid.
const PROVIDER_LABELS: Record<string, { label: string; description: string }> = {
  cod: {
    label: "Αντικαταβολή",
    description: "Πληρώνεις τοις μετρητοίς όταν παραλάβεις την παραγγελία σου.",
  },
};

export function PaymentSection({ providers }: { providers: PaymentProvider[] }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading number={6} title="Πληρωμή" />
      {providers.length === 0 ? (
        <p role="alert" className="text-sm text-danger">
          Δεν υπάρχει διαθέσιμος τρόπος πληρωμής αυτή τη στιγμή. Επικοινώνησε μαζί μας.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {providers.map((provider) => {
            const copy = PROVIDER_LABELS[provider.id] ?? { label: provider.id, description: "" };
            return (
              <label
                key={provider.id}
                className="flex cursor-pointer items-center gap-3 rounded-sm border border-ink px-4 py-3.5 text-sm"
              >
                <input type="radio" name="payment-provider" checked readOnly className="h-4 w-4 accent-accent" />
                <span className="flex flex-col">
                  <span className="font-medium text-ink">{copy.label}</span>
                  {copy.description && <span className="text-xs text-ink-muted">{copy.description}</span>}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}
