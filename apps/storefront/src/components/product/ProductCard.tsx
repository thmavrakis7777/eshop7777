"use client";

import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice, formatPriceFrom } from "@/lib/format";
import { ProductImage } from "@/components/ui/ProductImage";
import { Stars } from "@/components/ui/Stars";
import { StockStatus } from "@/components/product/StockStatus";
import { useQuickAdd } from "@/lib/hooks/use-quick-add";
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
  const { hasSingleVariant, isOutOfStock, isPending, error, quickAdd } = useQuickAdd(product);

  return (
    <article className="flex h-full flex-col">
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
            <ProductImage
              imageUrl={product.imageUrl}
              label={product.title}
              tone={product.placeholderTone}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            />
          </div>
        </Link>
        <WishlistButton
          handle={product.handle}
          title={product.title}
          className="absolute right-2 top-2 z-10 rounded-full bg-bg/90 p-2 text-ink backdrop-blur-sm transition-transform duration-150 ease-out hover:scale-110 active:scale-95"
        />
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-1">
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <Link
          href={`/proionta/${product.handle}`}
          title={product.title}
          className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-ink hover:underline underline-offset-2"
        >
          {product.title}
        </Link>
        {product.rating !== undefined && (
          <Stars rating={product.rating} count={product.reviewCount} />
        )}
        {product.code && <span className="text-xs text-ink-muted">Κωδικός: {product.code}</span>}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-ink">
            {product.priceRange ? formatPriceFrom(product.priceRange.min) : formatPrice(product.price)}
          </span>
          {!product.priceRange && product.compareAtPrice && (
            <span className="text-xs text-ink-muted line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>
        <StockStatus isAvailable={product.isAvailable} className="mt-0.5" />

        {hasSingleVariant ? (
          <button
            type="button"
            className="mt-auto w-full rounded-sm bg-ink px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            onClick={quickAdd}
            disabled={isPending || isOutOfStock}
          >
            {isOutOfStock ? "Εξαντλήθηκε" : isPending ? "Προσθήκη…" : "Προσθήκη στο καλάθι"}
          </button>
        ) : (
          <Link
            href={`/proionta/${product.handle}`}
            className="mt-auto w-full rounded-sm bg-ink px-4 py-2.5 text-center text-xs font-medium text-white transition-colors hover:bg-accent"
          >
            Επιλογές
          </Link>
        )}
      </div>
    </article>
  );
}
