/**
 * Products sold by length (LENGTH_SALES_SPEC.md) — the one place that turns
 * the shop's whole-number quantities into metres and back.
 *
 * A length product is counted in steps (0,5 μ for the gas hose): 2,5 μ is a
 * cart/order/stock quantity of 5. Every money and stock path keeps its
 * whole-number maths (unit price × quantity in cents, stock checks, the
 * orders totals CHECK); only what people read and type is in metres. The
 * variant's price stays per metre (3,00 €); the price of one step (1,50 €)
 * comes from stepPriceCents, at the two places money is fixed — adding to
 * the cart and checkout's re-pricing.
 *
 * No server imports: used by the product page, the cart and the dashboard.
 */

export type LengthRule = {
  /** One step in centimetres — 50 = sold in 0,5 μ steps. */
  stepCm: number;
  /** Smallest length one customer can buy, in cm (100 = 1 μ). */
  minCm: number;
  /** Largest length per order line, in cm (2000 = 20 μ) — not the stock. */
  maxCm: number;
};

export const METRE_SHORT = "μ";

/** Steps → metres, e.g. (5, 50) → 2.5. */
export function stepsToMetres(steps: number, stepCm: number): number {
  return (steps * stepCm) / 100;
}

/** «2,5 μ» — Greek decimal comma, no trailing ",0". */
export function formatMetres(steps: number, stepCm: number): string {
  const m = stepsToMetres(steps, stepCm);
  return `${m.toLocaleString("el-GR", { maximumFractionDigits: 2 })} ${METRE_SHORT}`;
}

/**
 * Metres as typed («2,5», «2.5», «3») → steps, or null when it isn't a
 * whole number of steps (2,3 μ with 0,5 μ steps) or isn't a number at all.
 * Callers decide what null means; nothing here rounds a length the shopper
 * didn't ask for.
 */
export function metresToSteps(input: string | number, stepCm: number): number | null {
  const n = typeof input === "number" ? input : Number(String(input).trim().replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const cm = Math.round(n * 1000) / 10; // 2.5 → 250, without 0.1+0.2 float noise
  if (cm % stepCm !== 0) return null;
  return cm / stepCm;
}

export function minSteps(rule: LengthRule): number {
  return Math.ceil(rule.minCm / rule.stepCm);
}

export function maxSteps(rule: LengthRule): number {
  return Math.floor(rule.maxCm / rule.stepCm);
}

/**
 * The price of one step from the price per metre, in whole cents — or null
 * when it doesn't divide evenly (2,99 €/μ in 0,5 μ steps would be 1,495 €).
 * The dashboard refuses such a price, so a saved length product always has
 * one; the money paths still treat null as an error, never round it.
 */
/**
 * Back from a cart/order line's per-step unit price to the price per metre
 * people read («3,00 € / μ»). Exact for any price stepPriceCents produced.
 */
export function perMetreCents(stepPriceCents: number, stepCm: number): number {
  return Math.round((stepPriceCents * 100) / stepCm);
}

export function stepPriceCents(pricePerMetreCents: number, stepCm: number): number | null {
  const scaled = pricePerMetreCents * stepCm;
  return scaled % 100 === 0 ? scaled / 100 : null;
}
