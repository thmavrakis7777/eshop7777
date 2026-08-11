"use client";

import Link from "next/link";
import type { Cart } from "@/lib/types";
import { useCartController } from "@/lib/hooks/use-cart-controller";
import { CartLineItemRow } from "@/components/cart/CartLineItemRow";
import { CartLineItemTableRow } from "@/components/cart/CartLineItemTableRow";
import { CartTableHeader } from "@/components/cart/CartTableHeader";
import { CouponForm } from "@/components/cart/CouponForm";
import { FreeShippingProgress } from "@/components/cart/FreeShippingProgress";
import { CartTotals } from "@/components/cart/CartTotals";
import { EmptyCartState } from "@/components/cart/EmptyCartState";

// Desktop (lg+): a true 5-column table, header included (CartTableHeader +
// CartLineItemTableRow). Below lg: the labeled-card layout (CartLineItemRow)
// — a purpose-built mobile layout, not the desktop table squeezed narrower.
// Both variants render from the same `cart.items` so they can never drift
// out of sync with each other; only one is ever visible at a given width.
export function CartPageView({ initialCart, cartMessage }: { initialCart: Cart; cartMessage: string | null }) {
  const controller = useCartController(initialCart);
  const cart = controller.cart;
  if (!cart) return null;

  if (cart.items.length === 0) {
    return <EmptyCartState />;
  }

  const rowProps = (itemId: string) => ({
    pending: controller.pendingLineId === itemId,
    error: controller.pendingLineId === itemId ? (controller.error ?? undefined) : undefined,
  });

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
      {/* min-w-0 is load-bearing: a CSS grid item's automatic min-width is
          its content's min-content size unless overridden, so without this
          the table's min-w-max below would bubble up and force the whole
          1fr track — and therefore the entire page — wider than the
          viewport instead of being contained by overflow-x-auto. */}
      <div className="min-w-0">
        {/* Header and rows share one horizontal-scroll container so they can
            never drift out of alignment — see cart-table-grid.ts for why a
            scroll fallback (rather than letting the ΠΡΟΪΟΝ column collapse)
            is the correct fix here. */}
        <div className="overflow-x-auto">
          <CartTableHeader />
          <div className="divide-y divide-border">
            {cart.items.map((item) => (
              <CartLineItemTableRow
                key={item.id}
                item={item}
                {...rowProps(item.id)}
                onQuantityChange={(q) => controller.updateQuantity(item.id, q)}
                onRemove={() => controller.removeItem(item.id)}
              />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border lg:hidden">
          {cart.items.map((item) => (
            <CartLineItemRow
              key={item.id}
              item={item}
              {...rowProps(item.id)}
              onQuantityChange={(q) => controller.updateQuantity(item.id, q)}
              onRemove={() => controller.removeItem(item.id)}
            />
          ))}
        </div>
      </div>

      <aside className="flex h-fit flex-col gap-4 rounded-md border border-border p-5 lg:sticky lg:top-24">
        {cartMessage && <p className="text-xs text-ink-muted">{cartMessage}</p>}
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
        <Link href="/" className="text-center text-sm text-ink-muted hover:text-ink hover:underline">
          Συνέχεια αγορών
        </Link>
      </aside>
    </div>
  );
}
