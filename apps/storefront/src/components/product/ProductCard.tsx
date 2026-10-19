"use client";

import Link from "@/components/ui/Link";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { formatPrice, formatPriceFrom } from "@/lib/format";
import { ProductImage } from "@/components/ui/ProductImage";
import { Stars } from "@/components/ui/Stars";
import { StockStatus } from "@/components/product/StockStatus";
import { useQuickAdd } from "@/lib/hooks/use-quick-add";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { stockStateOf } from "@/lib/stock";
import { ColourSwatches } from "@/components/product/ColourSwatches";
import {
  colourVariantsOf,
  defaultColourVariant,
  recallColourChoice,
  rememberColourChoice,
} from "@/lib/colour-variants";

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
export function ProductCard({
  product,
  // Matches the listing grid's real column count (4/3/2 columns at
  // lg/sm/base — see the grid this card renders in on category/search
  // pages). ProductRail passes its own value below: the rail's cards are
  // narrower than a grid column at the same breakpoint, and requesting the
  // grid's larger size there over-fetches image resolution for no visible
  // gain.
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
  // Straight through to ProductImage — see the note there. Only the listing
  // grid sets it, and only for its first row on the first page; every other
  // caller (rail, wishlist, journal) renders below the fold and keeps the
  // lazy default.
  priority = false,
  // Also straight through to ProductImage: only the homepage rails set it.
  waitForPageLoad = false,
}: {
  product: Product;
  sizes?: string;
  priority?: boolean;
  waitForPageLoad?: boolean;
}) {
  const { hasSingleVariant, isOutOfStock: productSoldOut, isPending, error, quickAdd, addVariant } =
    useQuickAdd(product);

  // Colour products (COLOR_VARIANTS_SPEC.md): the dots pick a colour, and
  // the photo, stock line and button follow it. The code stays the
  // product's main one (00017): the dots share its line, and a colour's
  // longer code (00017-2) would push four dots off a phone-width card. The
  // colour's own code shows on the product page, in the cart and on the
  // order. The first colour
  // in stock starts selected (owner's choice) unless this product's colour
  // was already picked during the visit — see rememberColourChoice.
  const colours = colourVariantsOf(product.variants);
  const [pickedId, setPickedId] = useState<string | null>(() => recallColourChoice(product.handle));
  const colour = colours ? (colours.find((v) => v.id === pickedId) ?? defaultColourVariant(colours)) : null;

  const isOutOfStock = colour ? !colour.isAvailable : productSoldOut;
  const imageUrl = colour?.imageUrl ?? product.imageUrl;

  return (
    <article className="flex h-full flex-col">
      {/* `group`: the photo zooms gently while the pointer is anywhere over
          it, the wishlist heart included (ProductImage hoverZoom). */}
      <div className="group relative overflow-hidden rounded-md">
        <Link href={`/proionta/${product.handle}`} className="block" tabIndex={-1} aria-hidden="true">
          {/* Phone cards are ~150px wide, so the badges there are smaller —
              full-size they covered the top third of the photo. `items-start`
              keeps each badge as wide as its own label instead of stretching
              «Νέο» to the width of «Προσφορά». */}
          {product.badges && product.badges.length > 0 && (
            <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
              {product.badges.map((b) => (
                <span
                  key={b}
                  className={`rounded-sm px-1 py-0.5 text-[10px] font-medium leading-4 sm:px-2 sm:py-1 sm:text-[11px] sm:leading-normal sm:tracking-wide ${
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
              imageUrl={imageUrl}
              label={product.title}
              tone={product.placeholderTone}
              sizes={sizes}
              priority={priority}
              waitForPageLoad={waitForPageLoad}
              hoverZoom
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
          // Two lines cut most titles short on a phone-width card, so phones
          // get three (every current title fits).
          className="line-clamp-3 min-h-10 text-sm font-medium leading-5 text-ink hover:underline underline-offset-2 sm:line-clamp-2"
        >
          {product.title}
        </Link>
        {product.rating !== undefined && (
          <Stars rating={product.rating} count={product.reviewCount} />
        )}

        {/* Pinned to the card's bottom: every caller lays cards out in a grid
            or flex row, which stretches the cards in a row to the tallest
            one, so code, price, stock and button line up across the row
            while any spare height sits under the shorter titles. A row
            whose titles all fit in two lines gets no gap at all. */}
        <div className="mt-auto flex flex-col gap-1">
          {colours && colour ? (
            // The dots on the code's line, not a line of their own — a
            // colour card stays as tall as the others in its row (owner,
            // 2026-10-16).
            <div className="flex items-center justify-between gap-1.5">
              {product.code && (
                <span className="min-w-0 truncate text-xs text-ink-muted">Κωδικός: {product.code}</span>
              )}
              <ColourSwatches
                colours={colours}
                selectedId={colour.id}
                onSelect={(v) => {
                  setPickedId(v.id);
                  rememberColourChoice(product.handle, v.id);
                }}
                size="sm"
                maxVisible={4}
                moreHref={`/proionta/${product.handle}`}
              />
            </div>
          ) : (
            product.code && <span className="text-xs text-ink-muted">Κωδικός: {product.code}</span>
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-ink">
              {/* A colour priced differently from the others shows its own
                  price — the one the button below will charge. */}
              {colour && product.priceRange
                ? formatPrice(colour.price)
                : product.priceRange
                  ? formatPriceFrom(product.priceRange.min)
                  : formatPrice(product.price)}
              {/* Sold by the metre (LENGTH_SALES_SPEC.md): the price is per metre. */}
              {product.length && <span className="font-normal text-ink-muted"> / μέτρο</span>}
            </span>
            {!product.priceRange && product.compareAtPrice && (
              <span className="text-xs text-ink-muted line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>
          <StockStatus state={stockStateOf(colour ? [colour] : product.variants)} className="mt-0.5" />

          {hasSingleVariant || colour ? (
            <button
              type="button"
              className="w-full rounded-sm bg-ink px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              onClick={colour ? () => addVariant(colour) : quickAdd}
              disabled={isPending || isOutOfStock}
            >
              {isOutOfStock ? "Εξαντλήθηκε" : isPending ? "Προσθήκη…" : "Προσθήκη στο καλάθι"}
            </button>
          ) : (
            <Link
              href={`/proionta/${product.handle}`}
              className="w-full rounded-sm bg-ink px-4 py-2.5 text-center text-xs font-medium text-white transition-colors hover:bg-accent"
            >
              {/* A length product picks its length on the product page (owner,
                  2026-10-17) — never a silent 1 μ add from the card. */}
              {product.length ? "Επίλεξε μήκος" : "Επιλογές"}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
