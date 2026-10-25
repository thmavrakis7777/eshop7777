import Link from "@/components/ui/Link";
import { CloseIcon } from "@/components/ui/Icons";
import type { ActiveFilterChip } from "@/lib/active-filters";

/**
 * What a filtered listing is filtered by, right above its products — so a
 * shopper who arrives from «Προσφορές Εβδομάδας!» or taps «Εφαρμογή
 * φίλτρων» can see the page changed, and undo one filter with one tap.
 * Each chip is a plain link (lib/active-filters.ts builds the hrefs).
 */
export function ActiveFilterChips({ chips, clearHref }: { chips: ActiveFilterChip[]; clearHref: string | null }) {
  if (chips.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Ενεργά φίλτρα">
      {chips.map((chip) => (
        <Link
          key={chip.label}
          href={chip.href}
          aria-label={`Αφαίρεση φίλτρου: ${chip.label}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {chip.label}
          <CloseIcon className="h-3.5 w-3.5" />
        </Link>
      ))}
      {clearHref && (
        <Link href={clearHref} className="px-1 py-1.5 text-sm text-ink-muted hover:text-ink hover:underline">
          Καθαρισμός όλων
        </Link>
      )}
    </div>
  );
}
