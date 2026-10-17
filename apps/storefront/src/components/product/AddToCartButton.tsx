"use client";

import { useState, useTransition } from "react";
import type { Product } from "@/lib/types";
import { addLineItemAction } from "@/lib/actions/cart";
import { useCartUI } from "@/components/cart/CartUIProvider";
import { trackAddToCart } from "@/lib/analytics/track";
import { QuantityStepper, useMaxReachedNotice } from "@/components/cart/QuantityStepper";
import { StockInquiryNotice } from "@/components/ui/StockInquiryNotice";
import { NotifyWhenAvailableForm } from "@/components/product/NotifyWhenAvailableForm";
import { isQuantityAvailable, quantityCap } from "@/lib/stock";
import type { StockInquiryContact } from "@/lib/whatsapp";
import { useColourSelection } from "@/components/product/ColourSelection";
import { ColourSwatches } from "@/components/product/ColourSwatches";
import { rememberColourChoice } from "@/lib/colour-variants";
import { formatMetres, maxSteps, minSteps, stepPriceCents } from "@/lib/length";
import { formatPrice } from "@/lib/format";

// Handles both today's catalog (always exactly one variant) and a future
// multi-variant product: with >1 variant, a choice is required before the
// button is enabled — never guesses by defaulting to variants[0]. The
// picker here is intentionally plain (radio group, not a styled swatch/size
// UI) since no real multi-variant product exists yet to design or verify a
// fancier one against. See PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md §2.3.
export function AddToCartButton({
  product,
  className,
  stockInquiry,
}: {
  product: Product;
  className?: string;
  // Global stock-quantity-limit + direct-inquiry feature — resolved once in
  // the PDP's page.tsx from site settings, not re-fetched here.
  stockInquiry: StockInquiryContact;
}) {
  const { showAddedToast, receiveCart } = useCartUI();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hasMultipleVariants = product.variants.length > 1;
  const [ownSelectedId, setSelectedVariantId] = useState<string | null>(
    hasMultipleVariants ? null : (product.variants[0]?.id ?? null)
  );
  // A colour product's choice lives in ColourSelectionProvider, shared with
  // the gallery and the stock line; it always has one (first in stock by
  // default), so the button is ready without a pick. Every other product
  // keeps its own state and the no-guessing rule above.
  const colourSelection = useColourSelection();
  const selectedVariantId = colourSelection ? colourSelection.selected.id : ownSelectedId;
  // Sold by length (LENGTH_SALES_SPEC.md): `quantity` counts steps (0,5 μ)
  // and starts at the product's minimum length; the variant's price is per
  // metre. For everything else floor is 1 and nothing below changes.
  const length = product.length;
  const floor = length ? minSteps(length) : 1;
  const [quantity, setQuantity] = useState(floor);
  // Adjusting state during render (React's documented pattern for deriving
  // state from a prop/state change — same pattern CartDrawer.tsx already
  // uses) rather than an effect: a variant switch (multi-variant product)
  // must not carry over a quantity that made sense for the previous
  // variant's stock, and this needs to take effect before paint.
  const [quantityForVariant, setQuantityForVariant] = useState(selectedVariantId);
  if (selectedVariantId !== quantityForVariant) {
    setQuantityForVariant(selectedVariantId);
    setQuantity(floor);
  }

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);
  const isOutOfStock = selectedVariant ? !selectedVariant.isAvailable : false;

  const exceedsStock = Boolean(
    selectedVariant &&
      !isOutOfStock &&
      !isQuantityAvailable(quantity, selectedVariant.inventoryQuantity, selectedVariant.allowBackorder)
  );
  // QuantityStepper reports whatever was actually typed, including 0 or a
  // negative number (native min/max attributes don't stop manual keyboard
  // entry) — never assume it's >= 1 just because that's the field's usual
  // range.
  const lengthMax = length ? maxSteps(length) : undefined;
  const isQuantityValid =
    Number.isInteger(quantity) && quantity >= floor && (lengthMax == null || quantity <= lengthMax);
  const canAdd = Boolean(selectedVariant) && !isOutOfStock && !exceedsStock && isQuantityValid;

  const stockCap = selectedVariant
    ? quantityCap(selectedVariant.inventoryQuantity, selectedVariant.allowBackorder)
    : undefined;
  // A length product has two ceilings: the stock and the owner's per-order
  // maximum (20 μ). "+" stops at whichever is lower, but only the stock one
  // is a stock question — at 20 μ with plenty on the roll, "+" just stops,
  // without the «ρώτα μας για απόθεμα» notice.
  const capIsLength = lengthMax != null && (stockCap == null || lengthMax < stockCap);
  const maxQuantity = capIsLength ? lengthMax : stockCap;
  // "+" pressed at the stock limit: same notice as a typed excess, but the
  // quantity stays at the limit and Add to cart stays enabled for it.
  const maxReached = useMaxReachedNotice(quantity, capIsLength ? undefined : maxQuantity);

  // The variant's price is per metre; one step costs half of it (whole
  // cents, lib/length.ts) and the total is steps × that — the same number
  // the cart will show.
  const stepCents =
    length && selectedVariant ? stepPriceCents(Math.round(selectedVariant.price.amount * 100), length.stepCm) : null;

  function handleClick() {
    if (!selectedVariantId || !canAdd) return;
    setError(null);
    startTransition(async () => {
      const result = await addLineItemAction(selectedVariantId, quantity);
      // Success or not, a returned cart is the server's current truth — it
      // is what updates the header badge now that actions no longer
      // re-render the page (CART_STATE_SPEC.md).
      if (result.cart) receiveCart(result.cart);
      if (result.ok) {
        showAddedToast();
        if (selectedVariant) {
          trackAddToCart({
            variantId: selectedVariant.id,
            title: product.title,
            // Per step for a length product, so price × quantity is the
            // real value (2,5 μ = 5 × 1,50 €), as in the cart.
            unitPriceAmount: stepCents != null ? stepCents / 100 : selectedVariant.price.amount,
            quantity,
          });
        }
      } else {
        setError(result.error);
      }
    });
  }

  const label = isOutOfStock
    ? "Εξαντλήθηκε"
    : isPending
      ? "Προσθήκη…"
      : !selectedVariant
        ? "Επίλεξε παραλλαγή"
        : "Προσθήκη στο καλάθι";

  return (
    <div className="flex flex-col gap-3">
      {colourSelection ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink">
            <span className="text-ink-muted">Χρώμα:</span>{" "}
            <span className="font-medium">{colourSelection.selected.title}</span>
            {!colourSelection.selected.isAvailable && <span className="text-ink-muted"> — Εξαντλήθηκε</span>}
          </p>
          <ColourSwatches
            colours={colourSelection.colours}
            selectedId={colourSelection.selected.id}
            onSelect={(v) => {
              colourSelection.pick(v.id);
              rememberColourChoice(product.handle, v.id);
            }}
            size="md"
          />
        </div>
      ) : hasMultipleVariants && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink">Επίλεξε παραλλαγή</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <label
                key={v.id}
                className={`cursor-pointer rounded-sm border px-3 py-2 text-sm transition-colors ${
                  selectedVariantId === v.id
                    ? "border-ink bg-ink text-white"
                    : "border-border text-ink hover:border-ink"
                } ${!v.isAvailable ? "opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="variant"
                  value={v.id}
                  checked={selectedVariantId === v.id}
                  onChange={() => setSelectedVariantId(v.id)}
                  className="sr-only"
                />
                {v.title}
                {!v.isAvailable && " — Εξαντλήθηκε"}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {selectedVariant && !isOutOfStock && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm text-ink-muted">{length ? "Μήκος:" : "Ποσότητα:"}</span>
            <QuantityStepper
              quantity={quantity}
              productTitle={product.title}
              editable
              max={maxQuantity}
              disabled={isPending}
              onChange={setQuantity}
              onMaxReached={capIsLength ? undefined : maxReached.onMaxReached}
              length={length}
            />
            {/* The owner's example: 2,5 μ → 7,50 €, updated as the length
                changes. Hidden while the typed length is out of range, where
                there's no real total to show. */}
            {length && stepCents != null && isQuantityValid && (
              <span className="text-sm text-ink">
                Σύνολο: <strong className="tabular-nums">{formatPrice({ ...selectedVariant.price, amount: (stepCents * quantity) / 100 })}</strong>
              </span>
            )}
          </div>
          {length && (
            <p className={`text-xs ${isQuantityValid ? "text-ink-muted" : "text-danger"}`}>
              Από {formatMetres(minSteps(length), length.stepCm)} έως {formatMetres(maxSteps(length), length.stepCm)}, ανά{" "}
              {formatMetres(1, length.stepCm)}.
            </p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          className={className}
          onClick={handleClick}
          disabled={isPending || !canAdd}
        >
          {label}
        </button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {(exceedsStock || maxReached.asked) && selectedVariant && (
          <StockInquiryNotice
            message={stockInquiry.message}
            productTitle={product.title}
            productCode={selectedVariant.code ?? product.code}
            whatsappPhone={stockInquiry.whatsappPhone}
            contactPhone={stockInquiry.contactPhone}
          />
        )}
        {/* Sold out (stock 0): the button above is already disabled and reads
            «Εξαντλήθηκε»; this lets the shopper ask to be told when it's back. */}
        {selectedVariant && isOutOfStock && (
          <NotifyWhenAvailableForm key={selectedVariant.id} variantId={selectedVariant.id} />
        )}
      </div>
    </div>
  );
}
