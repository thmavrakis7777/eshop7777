"use client";

import Link from "next/link";
import type { CartLineItem } from "@/lib/types";
import { formatPrice, discountPercent } from "@/lib/format";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import { QuantityStepper } from "@/components/cart/QuantityStepper";
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
  onQuantityChange,
  onRemove,
}: {
  item: CartLineItem;
  pending: boolean;
  error?: string;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const pct = discountPercent(item.unitPrice, item.compareAtUnitPrice);

  return (
    <div className={`hidden lg:grid ${CART_TABLE_GRID_COLS} items-center gap-4 py-6`}>
      <div className="flex min-w-0 gap-4">
        <Link href={`/proionta/${item.productHandle}`} className="w-28 shrink-0">
          <PlaceholderTile label={item.title} tone={item.placeholderTone} />
        </Link>
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          <Link
            href={`/proionta/${item.productHandle}`}
            className="text-sm font-medium leading-snug text-ink hover:underline"
          >
            {item.title}
          </Link>
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

      <div className="text-right text-sm text-ink-muted tabular-nums">
        {item.compareAtUnitPrice ? <span className="line-through">{formatPrice(item.compareAtUnitPrice)}</span> : "–"}
      </div>

      <div className="text-right">
        <span className="text-sm font-semibold text-ink tabular-nums">{formatPrice(item.unitPrice)}</span>
        {pct !== null && <div className="text-xs font-medium text-accent">-{pct}%</div>}
      </div>

      <div className="flex justify-center">
        <QuantityStepper
          quantity={item.quantity}
          productTitle={item.title}
          disabled={pending}
          onChange={onQuantityChange}
        />
      </div>

      <div className="text-right text-sm font-semibold text-ink tabular-nums">{formatPrice(item.lineTotal)}</div>

      {error && (
        <p role="alert" className="col-span-5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
