"use client";

import { useState, useTransition } from "react";
import type { Product } from "@/lib/types";
import { addLineItemAction } from "@/lib/actions/cart";
import { useCartUI } from "@/components/cart/CartUIProvider";

// Single-variant quick add only — never guesses a variant for a
// multi-variant product (see PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md §2.3).
// Callers with `hasSingleVariant === false` should route to the PDP instead
// of calling `quickAdd`. Shared by ProductCard and the search dropdown's
// result row so the add-to-cart behavior/toast timing lives in exactly one
// place rather than being copy-pasted per surface.
export function useQuickAdd(product: Product) {
  const { showAddedToast } = useCartUI();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasSingleVariant = product.variants.length === 1;
  const variant = product.variants[0];
  const isOutOfStock = !product.isAvailable;

  function quickAdd() {
    if (!variant) return;
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

  return { hasSingleVariant, isOutOfStock, isPending, error, quickAdd };
}
