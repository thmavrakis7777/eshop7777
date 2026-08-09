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

// Medusa stores weight in grams (documented default) — switches to κιλά
// above 1kg since "1500 γρ." reads worse than "1,5 κιλά" for anything a
// customer would actually pick up.
export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    const rounded = Math.round(kg * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toString().replace(".", ",")} κιλά`;
  }
  return `${grams} γρ.`;
}

// Medusa stores dimensions in centimeters (documented default). Renders
// only whichever of length/width/height are actually populated, joined in
// a fixed order — a product with just a height still shows something
// instead of nothing.
export function formatDimensions(d: { lengthCm?: number; widthCm?: number; heightCm?: number }): string | null {
  const parts = [d.lengthCm, d.widthCm, d.heightCm].filter((n): n is number => n != null);
  if (parts.length === 0) return null;
  return `${parts.join(" × ")} εκ.`;
}
