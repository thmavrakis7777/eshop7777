"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
// Matches the duration/easing on the panel's transition-transform below —
// the exit animation is timer-driven (not onTransitionEnd) so the drawer
// still unmounts cleanly under prefers-reduced-motion, where the CSS
// transition is disabled and no transitionend event would ever fire.
const EXIT_TRANSITION_MS = 300;

export function CartDrawer({
  cartMessage,
  freeShippingThresholdCents,
}: {
  cartMessage: string | null;
  freeShippingThresholdCents: number | null;
}) {
  const { isDrawerOpen, closeDrawer } = useCartUI();
  // Stays mounted for EXIT_TRANSITION_MS after isDrawerOpen goes false so the
  // slide/fade-out has something to animate — CartDrawerInner drives the
  // actual visibility via its own `open` prop.
  const [mounted, setMounted] = useState(false);

  // Adjusting state during render (React's documented pattern for deriving
  // state from a prop change) rather than an effect — this needs to take
  // effect before paint, not after a render round-trip.
  if (isDrawerOpen && !mounted) {
    setMounted(true);
  }

  if (!mounted) return null;
  return (
    <CartDrawerInner
      open={isDrawerOpen}
      onRequestClose={closeDrawer}
      onClosed={() => setMounted(false)}
      cartMessage={cartMessage}
      freeShippingThresholdCents={freeShippingThresholdCents}
    />
  );
}

function CartDrawerInner({
  open,
  onRequestClose,
  onClosed,
  cartMessage,
  freeShippingThresholdCents,
}: {
  open: boolean;
  onRequestClose: () => void;
  onClosed: () => void;
  cartMessage: string | null;
  freeShippingThresholdCents: number | null;
}) {
  const controller = useCartController(null);
  const router = useRouter();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Single flag driving both the enter (mount → true) and exit (open goes
  // false → false) animation via CSS transform/opacity.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    getCartAction().then((cart) => controller.setCart(cart));

    const frame = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same render-time-adjustment pattern as CartDrawer above.
  if (!open && visible) {
    setVisible(false);
  }

  useEffect(() => {
    if (open) return;
    const timer = setTimeout(onClosed, EXIT_TRANSITION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    onRequestClose();
  }

  function handleContinueShopping() {
    // Preserves cart/wishlist automatically — cart is cookie/server-backed,
    // wishlist is localStorage-backed, neither is tied to page lifetime.
    if (pathname !== "/") router.push("/");
    handleClose();
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cart = controller.cart;
  const itemCount = cart?.itemCount ?? 0;
  const hasItems = (cart?.items.length ?? 0) > 0;

  return createPortal(
    <div ref={dialogRef} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Καλάθι αγορών">
      <div
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
        onClick={handleClose}
      />
      <div
        // overflow-y-auto here (not just on the item list below) is the
        // actual fix, confirmed by measuring real layout at 1280x480 with
        // the coupon field expanded: the item list already shrinks and
        // scrolls internally on its own (its own overflow-y-auto already
        // floors its flex min-height to 0 per the flexbox spec — no bug
        // there). The real gap was that the HEADER+FOOTER together (title
        // bar, free-shipping line, coupon form, totals, checkout button) can
        // be taller than a short window on their own, even with the item
        // list squeezed to 0 — and neither they nor this outer panel could
        // scroll, so the footer's bottom edge ran past the viewport with no
        // way to reach it (measured: footer bottom at 486px in a 480px
        // window). Letting the whole panel scroll as a fallback is what
        // actually closes that gap, at any viewport height, without a
        // guessed breakpoint. overscroll-contain stops that scroll from
        // chaining to the page behind (matches the mega-menu panel's own
        // overscroll-contain in Header.tsx).
        className={`absolute inset-y-0 right-0 flex w-full flex-col overflow-y-auto overscroll-contain bg-bg shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none md:w-[440px] ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-lg">Το καλάθι σου {itemCount > 0 && `(${itemCount})`}</h2>
          <button ref={closeButtonRef} type="button" className="p-2" aria-label="Κλείσιμο καλαθιού" onClick={handleClose}>
            <CloseIcon />
          </button>
        </div>

        {/* min-h-0 makes explicit what overflow-y-auto already implies (a
            flex item with non-visible overflow floors its automatic
            min-height to 0 per spec) — kept for clarity, not because it
            changes behavior. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
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
                  error={controller.errorLineId === item.id ? (controller.error ?? undefined) : undefined}
                  onQuantityChange={(q) => controller.updateQuantity(item.id, q)}
                  onRemove={() => controller.removeItem(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {cart && hasItems && (
          <div className="flex flex-col gap-3 border-t border-border p-4">
            {cartMessage && <p className="text-xs text-ink-muted">{cartMessage}</p>}
            <FreeShippingProgress
              subtotalEur={cart.subtotal.amount - cart.discountTotal.amount}
              thresholdCents={freeShippingThresholdCents}
            />

            <CouponForm
              promotions={cart.promotions}
              discountTotal={cart.discountTotal}
              pending={controller.couponPending}
              onApply={controller.applyCoupon}
              onRemove={controller.removeCoupon}
            />

            <CartTotals cart={cart} />

            {/* Must close the drawer like every other link in here: the
                drawer lives in RootLayout, so a client-side navigation
                doesn't unmount it — without this it stays open on top of
                /checkout with `body { overflow: hidden }` still applied,
                covering the page entirely. Confirmed live. */}
            <Link
              href="/checkout"
              onClick={handleClose}
              className="rounded-sm bg-ink px-6 py-3.5 text-center text-sm font-medium tracking-wide text-white transition-colors hover:bg-accent"
            >
              ΟΛΟΚΛΗΡΩΣΗ ΑΓΟΡΑΣ
            </Link>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-ink-muted hover:text-ink hover:underline"
                onClick={handleContinueShopping}
              >
                Συνέχεια αγορών
              </button>
              <Link href="/kalathi" className="text-ink-muted hover:text-ink hover:underline" onClick={handleClose}>
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
