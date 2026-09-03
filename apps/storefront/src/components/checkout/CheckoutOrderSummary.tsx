import type { Cart } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/ui/ProductImage";
import { CartTotals } from "@/components/cart/CartTotals";
import { CloseIcon } from "@/components/ui/Icons";
import { StockInquiryNotice } from "@/components/ui/StockInquiryNotice";
import { isLineItemOverstocked } from "@/lib/stock";
import type { StockInquiryContact } from "@/lib/whatsapp";

// Compact line-item presentation (small thumbnail, quantity as plain text —
// checkout's summary has no stepper, editing quantity still happens back in
// the cart), not the cart's own 5-column table or labeled card — appropriate
// density for a sidebar/collapsed panel rather than a dedicated review page
// (CHECKOUT_UX_SPEC.md §10/§11). Mobile: a native <details> disclosure,
// collapsed by default but with the total always visible in the <summary>
// even collapsed — no JS needed for expand/collapse, keyboard-operable by
// default. Desktop: always-expanded sticky card, mirroring the cart page's
// own established sticky-summary layout. Each row does allow one edit —
// removing the item entirely — via a small "X" at the very start of the
// row (never the end, so it can't be mistaken for a quantity/price action).
export function CheckoutOrderSummary({
  cart,
  onRemove,
  pendingLineId,
  stockInquiry,
}: {
  cart: Cart;
  onRemove: (lineItemId: string) => void;
  // Disables just that row's remove button mid-request — never the whole
  // page — and gives it a quiet loading affordance.
  pendingLineId: string | null;
  stockInquiry: StockInquiryContact;
}) {
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
          <OrderSummaryContent cart={cart} onRemove={onRemove} pendingLineId={pendingLineId} stockInquiry={stockInquiry} />
        </div>
      </details>

      <div className="hidden rounded-md border border-border p-5 lg:sticky lg:top-24 lg:block">
        <h2 className="mb-4 font-display text-lg text-ink">Η παραγγελία σου</h2>
        <OrderSummaryContent cart={cart} onRemove={onRemove} pendingLineId={pendingLineId} stockInquiry={stockInquiry} />
      </div>
    </>
  );
}

function OrderSummaryContent({
  cart,
  onRemove,
  pendingLineId,
  stockInquiry,
}: {
  cart: Cart;
  onRemove: (lineItemId: string) => void;
  pendingLineId: string | null;
  stockInquiry: StockInquiryContact;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {cart.items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                disabled={pendingLineId === item.id}
                aria-label="Αφαίρεση προϊόντος"
                // 44px touch target via padding around a small visual glyph —
                // the icon itself stays elegant/quiet, the tappable area
                // doesn't. -ml-2 keeps the larger hit area from pushing the
                // thumbnail/title out of alignment with the rest of the row.
                className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:text-danger disabled:opacity-40"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
              <div className="w-12 shrink-0">
                <ProductImage imageUrl={item.imageUrl} label={item.title} tone={item.placeholderTone} sizes="48px" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-ink">{item.title}</span>
                <span className="text-xs text-ink-muted">Ποσ.: {item.quantity}</span>
              </div>
              <span className="shrink-0 text-sm text-ink tabular-nums">{formatPrice(item.lineTotal)}</span>
            </div>
            {isLineItemOverstocked(item) && (
              <StockInquiryNotice
                message={stockInquiry.message}
                productTitle={item.title}
                productCode={item.code}
                whatsappPhone={stockInquiry.whatsappPhone}
                contactPhone={stockInquiry.contactPhone}
              />
            )}
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
