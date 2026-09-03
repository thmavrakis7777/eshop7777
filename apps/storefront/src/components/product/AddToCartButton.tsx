"use client";

import { useState, useTransition } from "react";
import type { Product } from "@/lib/types";
import { addLineItemAction } from "@/lib/actions/cart";
import { useCartUI } from "@/components/cart/CartUIProvider";
import { trackAddToCart } from "@/lib/analytics/track";
import { QuantityStepper } from "@/components/cart/QuantityStepper";
import { StockInquiryNotice } from "@/components/ui/StockInquiryNotice";
import { isQuantityAvailable } from "@/lib/stock";
import type { StockInquiryContact } from "@/lib/whatsapp";

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
  const { showAddedToast } = useCartUI();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hasMultipleVariants = product.variants.length > 1;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    hasMultipleVariants ? null : (product.variants[0]?.id ?? null)
  );
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
  const canAdd = Boolean(selectedVariant) && !isOutOfStock && !exceedsStock;

  function handleClick() {
    if (!selectedVariantId || !canAdd) return;
    setError(null);
    startTransition(async () => {
      const result = await addLineItemAction(selectedVariantId, quantity);
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
      {hasMultipleVariants && (
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
            max={selectedVariant.allowBackorder ? undefined : selectedVariant.inventoryQuantity}
            disabled={isPending}
            onChange={setQuantity}
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
        {exceedsStock && selectedVariant && (
          <StockInquiryNotice
            message={stockInquiry.message}
            productTitle={product.title}
            productCode={selectedVariant.code ?? product.code}
            whatsappPhone={stockInquiry.whatsappPhone}
            contactPhone={stockInquiry.contactPhone}
          />
        )}
      </div>
    </div>
  );
}
