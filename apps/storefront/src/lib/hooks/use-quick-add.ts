"use client";

import { useState, useTransition } from "react";
import type { Product } from "@/lib/types";
import { addLineItemAction } from "@/lib/actions/cart";
import { useCartUI } from "@/components/cart/CartUIProvider";
import { trackAddToCart } from "@/lib/analytics/track";

// Single-variant quick add — never guesses a variant for a multi-variant
// product (see PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md §2.3). Callers with
// `hasSingleVariant === false` route to the PDP instead, with one exception:
// a colour product's card adds the colour the shopper can see selected
// (`addVariant`, COLOR_VARIANTS_SPEC.md) — a visible choice, not a guess. Shared by ProductCard and the search dropdown's
// result row so the add-to-cart behavior/toast timing lives in exactly one
// place rather than being copy-pasted per surface. Takes only the fields it
// reads, so a caller can hand a Client Component just those (the homepage's
// Editorial Showcase) instead of serializing whole products into the page.
export function useQuickAdd(product: Pick<Product, "title" | "isAvailable" | "variants" | "length">) {
  const { showAddedToast, receiveCart } = useCartUI();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // A product sold by length (LENGTH_SALES_SPEC.md) is never quick-added:
  // its length is chosen on the product page, so every caller that routes a
  // multi-variant product there does the same for it.
  const hasSingleVariant = product.variants.length === 1 && !product.length;
  const isOutOfStock = !product.isAvailable;

  // Two functions rather than one with an optional argument: callers hand
  // `quickAdd` straight to onClick, which would pass the click event in.
  function quickAdd() {
    const variant = product.variants[0];
    if (variant) addVariant(variant);
  }

  function addVariant(variant: Product["variants"][number]) {
    setError(null);
    startTransition(async () => {
      const result = await addLineItemAction(variant.id, 1);
      // Same as AddToCartButton: the returned cart updates the header badge.
      if (result.cart) receiveCart(result.cart);
      if (result.ok) {
        showAddedToast();
        trackAddToCart({
          variantId: variant.id,
          title: product.title,
          unitPriceAmount: variant.price.amount,
          quantity: 1,
        });
      } else {
        setError(result.error);
      }
    });
  }

  return { hasSingleVariant, isOutOfStock, isPending, error, quickAdd, addVariant };
}
