import type { Cart } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/ui/ProductImage";
import { CartTotals } from "@/components/cart/CartTotals";

// Compact line-item presentation (small thumbnail, no quantity stepper —
// checkout's summary is read-only, editing happens back in the cart), not
// the cart's own 5-column table or labeled card — appropriate density for
// a sidebar/collapsed panel rather than a dedicated review page
// (CHECKOUT_UX_SPEC.md §10/§11). Mobile: a native <details> disclosure,
// collapsed by default but with the total always visible in the <summary>
// even collapsed — no JS needed for expand/collapse, keyboard-operable by
// default. Desktop: always-expanded sticky card, mirroring the cart page's
// own established sticky-summary layout.
export function CheckoutOrderSummary({ cart }: { cart: Cart }) {
  return (
    <>
      <details className="rounded-md border border-border lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-medium text-ink">
          <span>Η παραγγελία σου</span>
          <span className="flex items-center gap-2 tabular-nums">
            {formatPrice(cart.total)}
            <ChevronIcon />
          </span>
        </summary>
        <div className="border-t border-border p-4">
          <OrderSummaryContent cart={cart} />
        </div>
      </details>

      <div className="hidden rounded-md border border-border p-5 lg:sticky lg:top-24 lg:block">
        <h2 className="mb-4 font-display text-lg text-ink">Η παραγγελία σου</h2>
        <OrderSummaryContent cart={cart} />
      </div>
    </>
  );
}

function OrderSummaryContent({ cart }: { cart: Cart }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {cart.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <div className="w-12 shrink-0">
              <ProductImage imageUrl={item.imageUrl} label={item.title} tone={item.placeholderTone} sizes="48px" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm text-ink">{item.title}</span>
              <span className="text-xs text-ink-muted">Ποσ.: {item.quantity}</span>
            </div>
            <span className="shrink-0 text-sm text-ink tabular-nums">{formatPrice(item.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <CartTotals cart={cart} />
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-ink-muted" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
