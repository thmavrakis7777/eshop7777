import { SectionHeading } from "@/components/checkout/SectionHeading";
import type { PaymentProvider } from "@/lib/types";

// Driven entirely by the admin-configurable provider list (Settings →
// Πληρωμές) — name/description are DB-editable now, not a local label map.
// A single active provider still renders as a plain selected row (nothing
// to choose); two or more render as real radio buttons.
export function PaymentSection({
  providers,
  selectedId,
  onSelect,
}: {
  providers: PaymentProvider[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading number={6} title="Πληρωμή" />
      {providers.length === 0 ? (
        <p role="alert" className="text-sm text-danger">
          Δεν υπάρχει διαθέσιμος τρόπος πληρωμής αυτή τη στιγμή. Επικοινώνησε μαζί μας.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {providers.map((provider) => (
            <label
              key={provider.id}
              className="flex cursor-pointer items-center gap-3 rounded-sm border border-ink px-4 py-3.5 text-sm has-[:checked]:bg-surface"
            >
              <input
                type="radio"
                name="payment-provider"
                checked={selectedId === provider.id}
                onChange={() => onSelect(provider.id)}
                className="h-4 w-4 accent-accent"
              />
              <span className="flex flex-col">
                <span className="font-medium text-ink">{provider.name}</span>
                {provider.description && <span className="text-xs text-ink-muted">{provider.description}</span>}
              </span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
