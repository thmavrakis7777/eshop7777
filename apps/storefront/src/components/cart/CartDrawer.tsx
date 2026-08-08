"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useCartUI } from "@/components/cart/CartUIProvider";
import { useCartController } from "@/lib/hooks/use-cart-controller";
import { getCartAction } from "@/lib/actions/cart";
import { CartLineItemRow } from "@/components/cart/CartLineItemRow";
import { CouponForm } from "@/components/cart/CouponForm";
import { FreeShippingProgress } from "@/components/cart/FreeShippingProgress";
import { CartTotals } from "@/components/cart/CartTotals";
import { EmptyCartState } from "@/components/cart/EmptyCartState";
import { CloseIcon } from "@/components/ui/Icons";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CartDrawer() {
  const { isDrawerOpen, closeDrawer } = useCartUI();

  // Reuses MobileMenu's conditional-mount pattern: no exit transition, but
  // every open is a fresh mount, which conveniently also means the cart is
  // always re-fetched fresh rather than risking stale state between opens.
  if (!isDrawerOpen) return null;
  return <CartDrawerInner onClose={closeDrawer} />;
}

function CartDrawerInner({ onClose }: { onClose: () => void }) {
  const controller = useCartController(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    getCartAction().then((cart) => controller.setCart(cart));

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onClose]);

  const cart = controller.cart;
  const itemCount = cart?.itemCount ?? 0;
  const hasItems = (cart?.items.length ?? 0) > 0;

  return createPortal(
    <div ref={dialogRef} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Καλάθι αγορών">
      <div className="absolute inset-0 bg-ink/40" aria-hidden="true" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full flex-col bg-bg shadow-xl md:w-[440px]">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-lg">Το καλάθι σου {itemCount > 0 && `(${itemCount})`}</h2>
          <button ref={closeButtonRef} type="button" className="p-2" aria-label="Κλείσιμο καλαθιού" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {!cart ? (
            <div className="flex flex-col gap-4 py-4" aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-20 w-20 shrink-0 animate-pulse rounded-md bg-surface" />
                  <div className="flex flex-1 flex-col gap-2 pt-1">
                    <div className="h-3 w-2/3 animate-pulse rounded-sm bg-surface" />
                    <div className="h-3 w-1/3 animate-pulse rounded-sm bg-surface" />
                  </div>
                </div>
              ))}
            </div>
          ) : !hasItems ? (
            <EmptyCartState compact />
          ) : (
            <div className="divide-y divide-border">
              {cart.items.map((item) => (
                <CartLineItemRow
                  key={item.id}
                  item={item}
                  pending={controller.pendingLineId === item.id}
                  error={controller.pendingLineId === item.id ? (controller.error ?? undefined) : undefined}
                  onQuantityChange={(q) => controller.updateQuantity(item.id, q)}
                  onRemove={() => controller.removeItem(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {cart && hasItems && (
          <div className="flex flex-col gap-3 border-t border-border p-4">
            <FreeShippingProgress subtotalEur={cart.subtotal.amount} />

            <CouponForm
              promotions={cart.promotions}
              discountTotal={cart.discountTotal}
              pending={controller.couponPending}
              onApply={controller.applyCoupon}
              onRemove={controller.removeCoupon}
            />

            <CartTotals cart={cart} />

            <Link
              href="/checkout"
              className="rounded-sm bg-ink px-6 py-3.5 text-center text-sm font-medium tracking-wide text-white transition-colors hover:bg-accent"
            >
              ΟΛΟΚΛΗΡΩΣΗ ΑΓΟΡΑΣ
            </Link>
            <div className="flex items-center justify-between text-sm">
              <button type="button" className="text-ink-muted hover:text-ink hover:underline" onClick={onClose}>
                Συνέχεια αγορών
              </button>
              <Link href="/kalathi" className="text-ink-muted hover:text-ink hover:underline" onClick={onClose}>
                Δες το καλάθι
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
