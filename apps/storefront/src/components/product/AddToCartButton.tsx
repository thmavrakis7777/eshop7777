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
  const [quantity, setQuantity] = useState(1);
  // Adjusting state during render (React's documented pattern for deriving
  // state from a prop/state change — same pattern CartDrawer.tsx already
  // uses) rather than an effect: a variant switch (multi-variant product)
  // must not carry over a quantity that made sense for the previous
  // variant's stock, and this needs to take effect before paint.
  const [quantityForVariant, setQuantityForVariant] = useState(selectedVariantId);
  if (selectedVariantId !== quantityForVariant) {
    setQuantityForVariant(selectedVariantId);
    setQuantity(1);
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
  const isQuantityValid = Number.isInteger(quantity) && quantity >= 1;
  const canAdd = Boolean(selectedVariant) && !isOutOfStock && !exceedsStock && isQuantityValid;

  const maxQuantity = selectedVariant
    ? quantityCap(selectedVariant.inventoryQuantity, selectedVariant.allowBackorder)
    : undefined;
  // "+" pressed at the stock limit: same notice as a typed excess, but the
  // quantity stays at the limit and Add to cart stays enabled for it.
  const maxReached = useMaxReachedNotice(quantity, maxQuantity);

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
            unitPriceAmount: selectedVariant.price.amount,
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-muted">Ποσότητα:</span>
          <QuantityStepper
            quantity={quantity}
            productTitle={product.title}
            editable
            max={maxQuantity}
            disabled={isPending}
            onChange={setQuantity}
            onMaxReached={maxReached.onMaxReached}
          />
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
