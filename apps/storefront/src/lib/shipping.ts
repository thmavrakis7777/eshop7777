/**
 * The Heavy/Bulky/Special shipping rule, shared by the actual charge
 * (computeTotals, lib/db/cart.ts — server-only) and its checkout-UI preview
 * (ShippingSection.tsx — a Client Component, which cannot import
 * server-only code) so the two can never disagree: when the cart contains
 * one or more oversized items, shipping is the HIGHEST single item's own
 * cost — never summed across multiple oversized lines, and never
 * multiplied by quantity. A normal-only cart (every cost 0/null) resolves
 * to 0, which callers treat as "no override, use the standard method price."
 *
 * This is a deliberate business rule, not an approximation: a mixed cart of
 * a €7 item and a €12 item pays €12 once, not €19 — and three of the €7
 * item still pays €7, not €21.
 */
export function highestOversizedFeeCents(shippingCostsCents: Array<number | null | undefined>): number {
  return shippingCostsCents.reduce((max: number, c) => Math.max(max, c ?? 0), 0);
}
