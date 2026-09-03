"use client";

import Link from "next/link";
import type { CartLineItem } from "@/lib/types";
import { formatPrice, discountPercent } from "@/lib/format";
import { ProductImage } from "@/components/ui/ProductImage";
import { QuantityStepper } from "@/components/cart/QuantityStepper";
import { StockInquiryNotice } from "@/components/ui/StockInquiryNotice";
import { isLineItemOverstocked } from "@/lib/stock";
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

  return (
    <div className="flex gap-4 py-5">
      <Link href={`/proionta/${item.productHandle}`} className="w-20 shrink-0 sm:w-24">
        <ProductImage imageUrl={item.imageUrl} label={item.title} tone={item.placeholderTone} sizes="96px" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Link href={`/proionta/${item.productHandle}`} className="text-sm font-medium leading-snug text-ink hover:underline">
          {item.title}
        </Link>
        {item.code && <span className="text-xs text-ink-muted">Κωδικός: {item.code}</span>}

        <div className="flex flex-col gap-0.5">
          {item.compareAtUnitPrice && (
            <div className="flex items-baseline gap-1.5 text-xs">
              <span className="text-ink-muted">Αρχική τιμή:</span>
              <span className="text-ink-muted line-through">{formatPrice(item.compareAtUnitPrice)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Τιμή:</span>
            <span className="font-semibold text-ink tabular-nums">{formatPrice(item.unitPrice)}</span>
            {pct !== null && (
              <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-white">
                -{pct}%
              </span>
            )}
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-ink-muted">Ποσότητα:</span>
          <QuantityStepper
            quantity={item.quantity}
            productTitle={item.title}
            disabled={pending}
            max={item.allowBackorder ? undefined : item.stockQuantity}
            onChange={onQuantityChange}
            onRemove={onRemove}
          />
        </div>

        <div className="flex items-baseline gap-1.5 text-sm">
          <span className="text-ink-muted">Σύνολο:</span>
          <span className="font-semibold text-ink tabular-nums">{formatPrice(item.lineTotal)}</span>
        </div>

        <button
          type="button"
          className="w-fit text-sm text-ink-muted hover:text-ink hover:underline disabled:opacity-50"
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
