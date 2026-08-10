"use client";

import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
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
      <div className={`flex items-center gap-3 px-3 py-2 transition-colors ${active ? "bg-surface" : ""}`}>
        <Link
          href={`/proionta/${product.handle}`}
          className="flex min-w-0 flex-1 items-center gap-3"
          onClick={onNavigate}
          tabIndex={-1}
        >
          <PlaceholderTile
            label={product.title}
            tone={product.placeholderTone}
            className="h-11 w-11 shrink-0"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm text-ink">{product.title}</span>
            {error ? (
              <span role="alert" className="truncate text-[11px] text-danger">
                {error}
              </span>
            ) : (
              <span className="truncate text-[11px] text-ink-muted">
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
              <span className="whitespace-nowrap text-[11px] text-ink-muted line-through">
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
