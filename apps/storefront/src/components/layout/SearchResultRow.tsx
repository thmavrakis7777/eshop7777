"use client";

import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/ui/ProductImage";
import { PlusIcon } from "@/components/ui/Icons";
import { useQuickAdd } from "@/lib/hooks/use-quick-add";

// Compact horizontal row for the search dropdown — deliberately not
// ProductCard's vertical card layout, since a dropdown needs
// [image][info][price][action] on one line. Shares useQuickAdd with
// ProductCard so add-to-cart behavior (including the multi-variant "no
// guessing" rule) and toast timing stay identical across both surfaces
// instead of drifting. Image/title navigate (real <a>, tabIndex -1 since
// arrow-key virtual navigation drives selection — see SearchBox); the
// quick-add button is a real, independently Tab-reachable control, not
// nested inside the link (invalid nested-interactive markup was a real bug
// fixed elsewhere in this project — not reintroducing it here).
export function SearchResultRow({
  product,
  optionId,
  active,
  onNavigate,
}: {
  product: Product;
  optionId: string;
  active: boolean;
  onNavigate: () => void;
}) {
  const { hasSingleVariant, isOutOfStock, isPending, error, quickAdd } = useQuickAdd(product);

  return (
    <li id={optionId} role="option" aria-selected={active}>
      <div className={`flex items-center gap-3 px-3 py-3 transition-colors sm:px-4 ${active ? "bg-surface" : ""}`}>
        <Link
          href={`/proionta/${product.handle}`}
          className="flex min-w-0 flex-1 items-center gap-3"
          onClick={onNavigate}
          tabIndex={-1}
        >
          {/* 44px was too small to actually recognise a product by — a
              thumbnail that size shows little more than the dominant colour,
              and PlaceholderTile's initials had to fight for room in it too.
              80px is what makes the photo the thing you scan the list by.
              Two tiers rather than one flat size because this row is
              [image][name][price][add] all on one line: below `sm` the width
              is genuinely scarce and the NAME needs those pixels more than
              the thumbnail does. Measured at 320px, a flat 80/64px box left
              the name column at 66px — narrower than the 44px thumbnail had
              left it, which would have made this a regression on the
              narrowest phone the shop supports rather than a fix. 56px there
              keeps the name column at its previous width while still being a
              third larger than before. `sizes` tracks the same two widths —
              a stale hint would have next/image serving a 44px-wide source
              into an 80px box. */}
          <div className="h-14 w-14 shrink-0 sm:h-20 sm:w-20">
            <ProductImage
              imageUrl={product.imageUrl}
              label={product.title}
              tone={product.placeholderTone}
              sizes="(min-width: 640px) 80px, 56px"
            />
          </div>
          <span className="flex min-w-0 flex-col gap-0.5">
            {/* line-clamp-2, not truncate: the taller row now has space for a
                second line, and a long Greek product name cut off after one
                was routinely losing the words that distinguish it from its
                neighbours (size, material, set count). Still bounded, so one
                verbose title cannot stretch the row without limit. */}
            <span className="line-clamp-2 text-sm text-ink">{product.title}</span>
            {error ? (
              <span role="alert" className="truncate text-xs text-danger">
                {error}
              </span>
            ) : (
              <span className="truncate text-xs text-ink-muted">
                {product.code && `Κωδικός: ${product.code}`}
                {product.code && isOutOfStock && " · "}
                {isOutOfStock && <span className="text-danger">Εξαντλήθηκε</span>}
              </span>
            )}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2.5">
          <span className="flex flex-col items-end leading-tight">
            <span className="whitespace-nowrap text-sm font-semibold text-ink">
              {formatPrice(product.price)}
            </span>
            {product.compareAtPrice && (
              <span className="whitespace-nowrap text-xs text-ink-muted line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </span>

          {hasSingleVariant ? (
            <button
              type="button"
              onClick={quickAdd}
              disabled={isPending || isOutOfStock}
              aria-label={
                isOutOfStock
                  ? `${product.title} — μη διαθέσιμο`
                  : `Προσθήκη ${product.title} στο καλάθι`
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-transparent disabled:text-ink-muted"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          ) : (
            <Link
              href={`/proionta/${product.handle}`}
              onClick={onNavigate}
              className="whitespace-nowrap text-xs font-medium text-accent hover:underline"
            >
              Επιλογές →
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
