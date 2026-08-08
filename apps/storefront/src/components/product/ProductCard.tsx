"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import { Stars } from "@/components/ui/Stars";
import { addLineItemAction } from "@/lib/actions/cart";
import { useCartUI } from "@/components/cart/CartUIProvider";

const BADGE_LABEL: Record<NonNullable<Product["badges"]>[number], string> = {
  new: "Νέο",
  sale: "Προσφορά",
};

export function ProductCard({ product }: { product: Product }) {
  const { showAddedToast } = useCartUI();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Multiple variants (size/color/...) means the customer must choose one —
  // never guess by adding variants[0]. No real multi-variant product exists
  // in the catalog yet; this path is forward design, routed to the PDP
  // rather than a speculative inline selector. See
  // PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md §2.3.
  const hasSingleVariant = product.variants.length === 1;
  const variant = product.variants[0];
  const isOutOfStock = !product.isAvailable;

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addLineItemAction(variant.id, 1);
      if (result.ok) {
        showAddedToast();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <article className="group relative flex flex-col">
      <div className="relative overflow-hidden rounded-md">
        <Link href={`/proionta/${product.handle}`} className="block" tabIndex={-1} aria-hidden="true">
          {(isOutOfStock || (product.badges && product.badges.length > 0)) && (
            <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
              {isOutOfStock && (
                <span className="rounded-sm bg-ink-muted px-2 py-1 text-[11px] font-medium tracking-wide text-white">
                  Εξαντλήθηκε
                </span>
              )}
              {product.badges?.map((b) => (
                <span
                  key={b}
                  className={`rounded-sm px-2 py-1 text-[11px] font-medium tracking-wide ${
                    b === "sale"
                      ? "bg-accent text-white"
                      : "bg-bg/90 text-ink backdrop-blur-sm"
                  }`}
                >
                  {BADGE_LABEL[b]}
                </span>
              ))}
            </div>
          )}
          <div
            className={`transition-transform duration-200 ease-out group-hover:scale-[1.03] ${
              isOutOfStock ? "opacity-70" : ""
            }`}
          >
            <PlaceholderTile label={product.title} tone={product.placeholderTone} />
          </div>
        </Link>
        {hasSingleVariant ? (
          <button
            type="button"
            // Always visible on mobile (touch has no hover state to reveal
            // it with — a hover-only control would make the button
            // unreachable, not just less discoverable). Desktop keeps the
            // quieter hover-reveal treatment.
            className="absolute bottom-2 right-2 flex items-center rounded-sm bg-ink px-3 py-2 text-xs font-medium text-white transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-100 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
            aria-label={
              isOutOfStock
                ? `${product.title} — Εξαντλήθηκε`
                : `Γρήγορη προσθήκη ${product.title} στο καλάθι`
            }
            onClick={handleQuickAdd}
            disabled={isPending || isOutOfStock}
          >
            {isOutOfStock ? "Εξαντλήθηκε" : isPending ? "…" : "+ Καλάθι"}
          </button>
        ) : (
          <Link
            href={`/proionta/${product.handle}`}
            className="absolute bottom-2 right-2 flex items-center rounded-sm bg-ink px-3 py-2 text-xs font-medium text-white transition-all duration-150 ease-out md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
            aria-label={`Επιλογές για ${product.title}`}
          >
            Επιλογές
          </Link>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <Link
          href={`/proionta/${product.handle}`}
          className="text-sm font-medium text-ink hover:underline underline-offset-2"
        >
          {product.title}
        </Link>
        {product.rating !== undefined && (
          <Stars rating={product.rating} count={product.reviewCount} />
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-ink">
            {formatPrice(product.price)}
          </span>
          {product.compareAtPrice && (
            <span className="text-xs text-ink-muted line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
