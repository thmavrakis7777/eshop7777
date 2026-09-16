"use client";

import Link from "next/link";
import type { CartLineItem } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/ui/ProductImage";
import { QuantityStepper } from "@/components/cart/QuantityStepper";
import { StockInquiryNotice } from "@/components/ui/StockInquiryNotice";
import { CloseIcon } from "@/components/ui/Icons";
import { isLineItemOverstocked } from "@/lib/stock";
import type { StockInquiryContact } from "@/lib/whatsapp";

// Compact, unlabeled row for the drawer only — sized so 2–2.5 products fit
// on a laptop screen instead of one. The full cart page keeps the labeled
// CartLineItemRow/CartLineItemTableRow, where there's room for them.
export function CartDrawerLineItem({
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
  const overstocked = isLineItemOverstocked(item);

  return (
    <div className="flex gap-3 py-4">
      <Link href={`/proionta/${item.productHandle}`} className="w-20 shrink-0">
        <ProductImage imageUrl={item.imageUrl} label={item.title} tone={item.placeholderTone} sizes="80px" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-2">
          <Link
            href={`/proionta/${item.productHandle}`}
            className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:underline"
            title={item.title}
          >
            {item.title}
          </Link>
          <button
            type="button"
            className="-m-2 shrink-0 p-2 text-ink-muted hover:text-ink disabled:opacity-50"
            aria-label={`Αφαίρεση ${item.title} από το καλάθι`}
            disabled={pending}
            onClick={onRemove}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <QuantityStepper
            quantity={item.quantity}
            productTitle={item.title}
            editable
            disabled={pending}
            max={item.allowBackorder ? undefined : item.stockQuantity}
            onChange={onQuantityChange}
            onRemove={onRemove}
          />
          {/* Same order as ProductCard: discounted price, then the original
              struck through beside it. */}
          <div className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-2 text-sm tabular-nums">
            <span className="font-semibold text-ink">{formatPrice(item.lineTotal)}</span>
            {item.compareAtUnitPrice && (
              <span className="text-xs text-ink-muted line-through">
                {formatPrice({ ...item.compareAtUnitPrice, amount: item.compareAtUnitPrice.amount * item.quantity })}
              </span>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        {overstocked && (
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
