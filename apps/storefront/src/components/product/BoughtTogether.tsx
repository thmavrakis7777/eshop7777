import Link from "@/components/ui/Link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/ui/ProductImage";
import { ShowcaseAddButton } from "@/components/home/ShowcaseAddButton";

/**
 * «Συνήθως αγοράζεται μαζί» under the PDP's add-to-cart button: one quiet
 * row per companion (lib/bought-together.ts) — small photo, name, price and
 * the Editorial Showcase's round "+" — so each is one tap away without
 * competing with the product's own button. Same quick add as everywhere
 * else (toast, header badge, analytics) via ShowcaseAddButton.
 *
 * The page passes only companions that can be quick-added (one variant, not
 * by length, in stock — see canShowCompanion); a sold-out one simply drops
 * out, and with none left the box isn't rendered at all, rather than a
 * suggestion the shopper can't act on.
 */
export function BoughtTogether({ companions }: { companions: Product[] }) {
  return (
    <section aria-labelledby="bought-together-heading" className="mt-6 rounded-sm border border-border p-3">
      <h2 id="bought-together-heading" className="text-xs text-ink-muted">
        Συνήθως αγοράζεται μαζί
      </h2>
      <ul className="mt-2 flex flex-col divide-y divide-border">
        {companions.map((companion) => {
          const href = `/proionta/${companion.handle}`;
          return (
            <li key={companion.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
              <Link href={href} tabIndex={-1} aria-hidden="true" className="size-14 flex-none">
                <ProductImage
                  imageUrl={companion.imageUrl}
                  label={companion.title}
                  tone={companion.placeholderTone}
                  sizes="56px"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link href={href} className="line-clamp-2 text-sm text-ink hover:underline">
                  {companion.title}
                </Link>
                <span className="text-sm font-semibold tabular-nums text-ink">{formatPrice(companion.price)}</span>
              </div>
              <ShowcaseAddButton
                product={{ title: companion.title, isAvailable: companion.isAvailable, variants: companion.variants }}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Whether a companion can be added straight from its row (see above). */
export function canShowCompanion(companion: Product | undefined, current: Product): companion is Product {
  return Boolean(
    companion && companion.id !== current.id && companion.isAvailable && companion.variants.length === 1 && !companion.length
  );
}
