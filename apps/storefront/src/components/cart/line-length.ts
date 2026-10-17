import type { CartLineItem, Money } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { maxSteps, perMetreCents } from "@/lib/length";
import { quantityCap } from "@/lib/stock";

/**
 * Shared by the mini-cart, the cart page (both layouts) and the checkout
 * summary, so a hose line (LENGTH_SALES_SPEC.md) reads and behaves the same
 * everywhere it appears.
 */

/**
 * The "+" ceiling for a line: the stock, or for a length product the lower
 * of the stock and the per-order maximum (20 μ). `capIsLength` says the
 * ceiling is the owner's limit rather than the stock — then "+" just stops,
 * without the stock-inquiry notice, which would ask about stock there is.
 */
export function lineMax(item: CartLineItem): { max: number | undefined; capIsLength: boolean } {
  const stockCap = quantityCap(item.stockQuantity, item.allowBackorder);
  if (!item.length) return { max: stockCap, capIsLength: false };
  const lengthMax = maxSteps(item.length);
  return stockCap == null || lengthMax < stockCap
    ? { max: lengthMax, capIsLength: true }
    : { max: stockCap, capIsLength: false };
}

/**
 * A line's unit price as people read it: «1,50 €» per piece, or for a length
 * line the price per metre («3,00 €/μ») — the cart stores the price of one
 * 0,5 μ step, which nobody should ever see.
 */
export function formatLineUnitPrice(price: Money, item: CartLineItem): string {
  if (!item.length) return formatPrice(price);
  const perMetre = perMetreCents(Math.round(price.amount * 100), item.length.stepCm) / 100;
  return `${formatPrice({ ...price, amount: perMetre })}/μ`;
}
