"use client";

import Link from "next/link";
import type { CartLineItem } from "@/lib/types";
import { formatPrice, discountPercent } from "@/lib/format";
import { ProductImage } from "@/components/ui/ProductImage";
import { QuantityStepper } from "@/components/cart/QuantityStepper";
import { StockInquiryNotice } from "@/components/ui/StockInquiryNotice";
import { isLineItemOverstocked } from "@/lib/stock";
import type { StockInquiryContact } from "@/lib/whatsapp";
import { CART_TABLE_GRID_COLS } from "@/components/cart/cart-table-grid";

// True 5-column table row, paired with CartTableHeader — desktop only
// (lg+, rendered by CartPageView). Values sit under their column header
// with no repeated inline label; that's what the header is for. See
// CartLineItemRow for the labeled-card equivalent used in the drawer and
// below lg, where five aligned columns wouldn't fit cleanly.
export function CartLineItemTableRow({
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
    <div className={`hidden lg:grid ${CART_TABLE_GRID_COLS} items-center gap-4 py-6`}>
      <div className="flex min-w-0 gap-4">
        <Link href={`/proionta/${item.productHandle}`} className="w-28 shrink-0">
          <ProductImage imageUrl={item.imageUrl} label={item.title} tone={item.placeholderTone} sizes="112px" />
        </Link>
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          <Link
            href={`/proionta/${item.productHandle}`}
            className="text-sm font-medium leading-snug text-ink hover:underline"
          >
            {item.title}
          </Link>
          {item.code && <span className="text-xs text-ink-muted">Κωδικός: {item.code}</span>}
          <button
            type="button"
            className="w-fit text-sm text-ink-muted hover:text-ink hover:underline disabled:opacity-50"
            disabled={pending}
            onClick={onRemove}
          >
            Αφαίρεση
          </button>
        </div>
      </div>

      <div className="text-center text-sm text-ink-muted tabular-nums">
        {item.compareAtUnitPrice ? <span className="line-through">{formatPrice(item.compareAtUnitPrice)}</span> : "–"}
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-semibold text-ink tabular-nums">{formatPrice(item.unitPrice)}</span>
        {pct !== null && (
          <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-white">
            -{pct}%
          </span>
        )}
      </div>

      <div className="flex justify-center">
        <QuantityStepper
          quantity={item.quantity}
          productTitle={item.title}
          disabled={pending}
          max={item.allowBackorder ? undefined : item.stockQuantity}
          onChange={onQuantityChange}
          onRemove={onRemove}
        />
      </div>

      <div className="text-center text-sm font-semibold text-ink tabular-nums">{formatPrice(item.lineTotal)}</div>

      {error && (
        <p role="alert" className="col-span-5 text-xs text-danger">
          {error}
        </p>
      )}
      {overstocked && (
        <div className="col-span-5">
          <StockInquiryNotice
            message={stockInquiry.message}
            productTitle={item.title}
            productCode={item.code}
            whatsappPhone={stockInquiry.whatsappPhone}
            contactPhone={stockInquiry.contactPhone}
          />
        </div>
      )}
    </div>
  );
}
