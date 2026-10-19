"use client";

import Link from "@/components/ui/Link";
import type { CartLineItem } from "@/lib/types";
import { formatPrice, discountPercent } from "@/lib/format";
import { ProductImage } from "@/components/ui/ProductImage";
import { LineColour } from "@/components/cart/LineColour";
import { formatLineUnitPrice, lineMax } from "@/components/cart/line-length";
import { QuantityStepper, useMaxReachedNotice } from "@/components/cart/QuantityStepper";
import { StockInquiryNotice } from "@/components/ui/StockInquiryNotice";
import { isLineItemOverstocked, isOnOrder, ON_ORDER_DELIVERY_TEXT } from "@/lib/stock";
import type { StockInquiryContact } from "@/lib/whatsapp";

// The labeled-card layout — used by the drawer at every width (it's a
// fixed, narrow panel, so a 5-column table would force tiny text) and by
// the full cart page below the lg breakpoint. See CartLineItemTableRow for
// the true table used on the full page at lg+. Every value here has an
// explicit Greek label so nothing has to be inferred (Cart clarity pass,
// 2026-08-08) — the opposite of the original unlabeled version.
export function CartLineItemRow({
  item,
  pending,
  error,
  stockInquiry,
  onQuantityChange,
  onRemove,
}: {
  item: CartLineItem;
  pending: boolean;
  error?: string;
  stockInquiry: StockInquiryContact;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const pct = discountPercent(item.unitPrice, item.compareAtUnitPrice);
  const overstocked = isLineItemOverstocked(item);
  // Stock, or for a hose line the lower of stock and 20 μ (line-length.ts).
  const { max: maxQuantity, capIsLength } = lineMax(item);
  const onOrder = isOnOrder(item.stockQuantity, item.allowBackorder);
  // "+" pressed at the stock limit shows the same notice (QuantityStepper).
  const maxReached = useMaxReachedNotice(item.quantity, capIsLength ? undefined : maxQuantity);

  return (
    <div className="flex gap-4 py-5">
      <Link href={`/proionta/${item.productHandle}`} className="w-20 shrink-0 sm:w-24">
        <ProductImage imageUrl={item.imageUrl} label={item.title} tone={item.placeholderTone} sizes="96px" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Link href={`/proionta/${item.productHandle}`} className="text-sm font-medium leading-snug text-ink hover:underline">
          {item.title}
        </Link>
        <LineColour colour={item.colour} />
        {item.code && <span className="text-xs text-ink-muted">Κωδικός: {item.code}</span>}
        {onOrder && <span className="text-xs text-accent">{ON_ORDER_DELIVERY_TEXT}</span>}

        <div className="flex flex-col gap-0.5">
          {item.compareAtUnitPrice && (
            <div className="flex items-baseline gap-1.5 text-xs">
              <span className="text-ink-muted">Αρχική τιμή:</span>
              <span className="text-ink-muted line-through">{formatLineUnitPrice(item.compareAtUnitPrice, item)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Τιμή:</span>
            <span className="font-semibold text-ink tabular-nums">{formatLineUnitPrice(item.unitPrice, item)}</span>
            {pct !== null && (
              <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-white">
                -{pct}%
              </span>
            )}
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-ink-muted">{item.length ? "Μήκος:" : "Ποσότητα:"}</span>
          <QuantityStepper
            quantity={item.quantity}
            productTitle={item.title}
            editable
            disabled={pending}
            max={maxQuantity}
            onChange={onQuantityChange}
            onMaxReached={capIsLength ? undefined : maxReached.onMaxReached}
            length={item.length}
            onRemove={onRemove}
          />
        </div>

        <div className="flex items-baseline gap-1.5 text-sm">
          <span className="text-ink-muted">Σύνολο:</span>
          <span className="font-semibold text-ink tabular-nums">{formatPrice(item.lineTotal)}</span>
        </div>

        <button
          type="button"
          // -my-3 py-3 grows the tap target to ~44px (matching QuantityStepper's
          // own buttons above) without pushing this row's visible spacing —
          // the negative margin cancels the padding's contribution to layout,
          // so only the invisible hit area grows, not the text's position.
          className="-my-3 w-fit py-3 text-sm text-ink-muted hover:text-ink hover:underline disabled:opacity-50"
          disabled={pending}
          onClick={onRemove}
        >
          Αφαίρεση
        </button>

        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        {(overstocked || maxReached.asked) && (
          <StockInquiryNotice
            message={stockInquiry.message}
            productTitle={item.title}
            productCode={item.code}
            whatsappPhone={stockInquiry.whatsappPhone}
            contactPhone={stockInquiry.contactPhone}
          />
        )}
      </div>
    </div>
  );
}
