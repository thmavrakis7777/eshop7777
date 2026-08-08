"use client";

import { useState, useTransition } from "react";
import type { Cart } from "@/lib/types";
import {
  updateLineItemQuantityAction,
  removeLineItemAction,
  applyPromoCodeAction,
  removePromoCodeAction,
} from "@/lib/actions/cart";

// Optimistically patches only the touched line's quantity/line-total for
// instant feedback (CART_UX_SPEC.md §10) — cart-level subtotal/discount/tax
// depend on server-side promotion/tax logic this hook has no business
// reimplementing, so those stay at their last-known value until the real
// response reconciles them a moment later (surfaced via `pendingLineId`).
function withOptimisticQuantity(cart: Cart, lineId: string, quantity: number): Cart {
  return {
    ...cart,
    items: cart.items.map((item) =>
      item.id === lineId
        ? { ...item, quantity, lineTotal: { ...item.unitPrice, amount: item.unitPrice.amount * quantity } }
        : item
    ),
  };
}

function withOptimisticRemoval(cart: Cart, lineId: string): Cart {
  const removed = cart.items.find((i) => i.id === lineId);
  return {
    ...cart,
    items: cart.items.filter((i) => i.id !== lineId),
    itemCount: cart.itemCount - (removed?.quantity ?? 0),
  };
}

export function useCartController(initialCart: Cart | null) {
  const [cart, setCart] = useState<Cart | null>(initialCart);
  const [error, setError] = useState<string | null>(null);
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);
  const [couponPending, setCouponPending] = useState(false);
  const [, startTransition] = useTransition();

  function updateQuantity(lineId: string, quantity: number) {
    setError(null);
    setPendingLineId(lineId);
    setCart((prev) => (prev ? withOptimisticQuantity(prev, lineId, quantity) : prev));
    startTransition(async () => {
      const result = await updateLineItemQuantityAction(lineId, quantity);
      if (result.cart) setCart(result.cart);
      if (!result.ok) setError(result.error);
      setPendingLineId(null);
    });
  }

  function removeItem(lineId: string) {
    setError(null);
    setPendingLineId(lineId);
    setCart((prev) => (prev ? withOptimisticRemoval(prev, lineId) : prev));
    startTransition(async () => {
      const result = await removeLineItemAction(lineId);
      if (result.cart) setCart(result.cart);
      if (!result.ok) setError(result.error);
      setPendingLineId(null);
    });
  }

  function applyCoupon(code: string, onSettled: (ok: boolean, error?: string) => void) {
    setCouponPending(true);
    startTransition(async () => {
      const result = await applyPromoCodeAction(code);
      if (result.cart) setCart(result.cart);
      setCouponPending(false);
      onSettled(result.ok, result.ok ? undefined : result.error);
    });
  }

  function removeCoupon(code: string) {
    setCouponPending(true);
    startTransition(async () => {
      const result = await removePromoCodeAction(code);
      if (result.cart) setCart(result.cart);
      setCouponPending(false);
    });
  }

  return {
    cart,
    setCart,
    error,
    pendingLineId,
    couponPending,
    updateQuantity,
    removeItem,
    applyCoupon,
    removeCoupon,
  };
}

export type CartController = ReturnType<typeof useCartController>;
