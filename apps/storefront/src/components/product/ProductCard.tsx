"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import { Stars } from "@/components/ui/Stars";
import { StockStatus } from "@/components/product/StockStatus";
import { addLineItemAction } from "@/lib/actions/cart";
import { useCartUI } from "@/components/cart/CartUIProvider";
import { WishlistButton } from "@/components/wishlist/WishlistButton";

const BADGE_LABEL: Record<NonNullable<Product["badges"]>[number], string> = {
  new: "Νέο",
  sale: "Προσφορά",
};

// Hierarchy (image → title → code → price → stock → Add to Cart) approved
// in PRODUCT_CARD_WISHLIST_PDP_SPEC.md §1 — identity and price read before
// the action, rather than the button competing with the image for
// attention. Add to Cart is a real row in normal flow now, not an
// absolutely-positioned overlay — which also removes the old
// hover-to-reveal/mobile-always-visible split entirely (Phase 5's fix for
// that is now moot, not reintroduced).
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

  function handleQuickAdd() {
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
    <article className="flex flex-col">
      <div className="relative overflow-hidden rounded-md">
        <Link href={`/proionta/${product.handle}`} className="block" tabIndex={-1} aria-hidden="true">
          {product.badges && product.badges.length > 0 && (
            <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
              {product.badges.map((b) => (
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
          <div className={isOutOfStock ? "opacity-70" : ""}>
            <PlaceholderTile label={product.title} tone={product.placeholderTone} />
          </div>
        </Link>
        <WishlistButton
          handle={product.handle}
          title={product.title}
          className="absolute right-2 top-2 z-10 rounded-full bg-bg/90 p-2 text-ink backdrop-blur-sm transition-transform duration-150 ease-out hover:scale-110 active:scale-95"
        />
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
        {product.code && <span className="text-xs text-ink-muted">Κωδικός: {product.code}</span>}
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
        <StockStatus isAvailable={product.isAvailable} className="mt-0.5" />

        {hasSingleVariant ? (
          <button
            type="button"
            className="mt-2 w-full rounded-sm bg-ink px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleQuickAdd}
            disabled={isPending || isOutOfStock}
          >
            {isOutOfStock ? "Εξαντλήθηκε" : isPending ? "Προσθήκη…" : "Προσθήκη στο καλάθι"}
          </button>
        ) : (
          <Link
            href={`/proionta/${product.handle}`}
            className="mt-2 w-full rounded-sm bg-ink px-4 py-2.5 text-center text-xs font-medium text-white transition-colors hover:bg-accent"
          >
            Επιλογές
          </Link>
        )}
      </div>
    </article>
  );
}
