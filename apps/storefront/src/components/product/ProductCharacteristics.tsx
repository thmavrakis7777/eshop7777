import type { ProductCharacteristics as Characteristics } from "@/lib/types";
import { formatDimensions, formatWeight } from "@/lib/format";

// Own labeled section (not folded into the existing delivery/returns/
// payment metadata block) — a dedicated <h2> is what makes this real,
// crawlable PDP content rather than an unlabeled aside. Renders nothing at
// all when `characteristics` is null, which is the honest state for every
// real product today — see PRODUCT_CARD_WISHLIST_PDP_SPEC.md §4 for why
// this ships empty rather than with invented specs.
export function ProductCharacteristics({ characteristics }: { characteristics: Characteristics | null }) {
  if (!characteristics) return null;

  const dimensions = formatDimensions(characteristics);
  const rows: Array<[string, string]> = [
    characteristics.material ? (["Υλικό", characteristics.material] as [string, string]) : null,
    characteristics.weightGrams != null
      ? (["Βάρος", formatWeight(characteristics.weightGrams)] as [string, string])
      : null,
    dimensions ? (["Διαστάσεις", dimensions] as [string, string]) : null,
    characteristics.originCountry ? (["Χώρα προέλευσης", characteristics.originCountry] as [string, string]) : null,
  ].filter((row): row is [string, string] => row !== null);

  if (rows.length === 0) return null;

  return (
    <section className="container-shell mt-12 max-w-2xl md:mt-16">
      <h2 className="font-display text-xl text-ink md:text-2xl">Χαρακτηριστικά</h2>
      <dl className="mt-4 flex flex-col gap-3 border-t border-border pt-6 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
