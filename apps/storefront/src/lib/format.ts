import type { Money } from "./types";

const formatter = new Intl.NumberFormat("el-GR", {
  style: "currency",
  currency: "EUR",
});

export function formatPrice(money: Money): string {
  return formatter.format(money.amount);
}

// null when there's nothing to show — callers render a neutral placeholder
// ("–") rather than a fake 0%, keeping every row the same shape.
export function discountPercent(unitPrice: Money, compareAtUnitPrice?: Money): number | null {
  if (!compareAtUnitPrice || compareAtUnitPrice.amount <= unitPrice.amount) return null;
  return Math.round(((compareAtUnitPrice.amount - unitPrice.amount) / compareAtUnitPrice.amount) * 100);
}
