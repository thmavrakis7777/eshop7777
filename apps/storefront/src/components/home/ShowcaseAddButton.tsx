"use client";

import type { Product } from "@/lib/types";
import { useQuickAdd } from "@/lib/hooks/use-quick-add";
import { PlusIcon } from "@/components/ui/Icons";

/**
 * The Editorial Showcase's add-to-cart: a quiet 44 px round "+" beside the
 * price, instead of ProductCard's full-width black bar — the section reads
 * as editorial, and the action is still one tap away. Same quick add as the
 * cards (toast, header badge, analytics), via useQuickAdd.
 *
 * The only client JavaScript a showcase ships. It's rendered only for a
 * product that can be quick-added (one variant, in stock) — EditorialShowcase
 * decides that on the server — and it gets just the fields useQuickAdd
 * reads, not the whole product.
 */
export function ShowcaseAddButton({ product }: { product: Pick<Product, "title" | "isAvailable" | "variants"> }) {
  const { isPending, error, quickAdd } = useQuickAdd(product);

  return (
    <span className="relative flex-none">
      <button
        type="button"
        onClick={quickAdd}
        disabled={isPending}
        aria-busy={isPending}
        aria-label={`Προσθήκη στο καλάθι: ${product.title}`}
        className="flex size-11 items-center justify-center rounded-full border border-ink/15 text-ink transition-colors duration-150 hover:border-ink hover:bg-ink hover:text-white disabled:cursor-wait disabled:opacity-60"
      >
        <PlusIcon className="size-4" />
      </button>
      {/* Absolutely placed so a failed add (e.g. the last one just sold)
          can say why without pushing the row's layout around. */}
      {error && (
        <span
          role="alert"
          className="absolute right-0 top-full z-10 mt-1 w-max max-w-48 text-right text-[11px] leading-tight text-danger"
        >
          {error}
        </span>
      )}
    </span>
  );
}
