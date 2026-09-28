import { describe, it, expect } from "vitest";
import { computeTotals, recomputeTotals } from "./cart-totals";
import type { Cart, CartLineItem } from "@/lib/types";

// Exercises the real production computeTotals (lib/cart-totals.ts) — no
// mirror, no copy of the pricing formula. Pure and dependency-free by design
// (see its own comment), so no database or mocking is needed.

const NO_SHIPPING = null;
const STANDARD_SHIPPING = { price_cents: 350, free_over_cents: 7900, is_pickup: false };
const HERAKLION_SHIPPING = { price_cents: 0, free_over_cents: 3000, is_pickup: false, heraklion_only: true };
const PICKUP = { price_cents: 0, free_over_cents: null, is_pickup: true };

function item(unitPriceCents: number, quantity = 1, shippingCostCents: number | null = null) {
  return { unit_price_cents: unitPriceCents, quantity, shipping_cost_cents: shippingCostCents };
}

describe("computeTotals", () => {
  it("an empty cart totals to zero", () => {
    const t = computeTotals({ items: [], discount: null, shipping: null });
    expect(t.subtotalCents).toBe(0);
    expect(t.totalCents).toBe(0);
    expect(t.shippingCents).toBe(0);
    expect(t.vatCents).toBe(0);
  });

  it("one item, no discount, no shipping method chosen yet", () => {
    const t = computeTotals({ items: [item(1000)], discount: null, shipping: NO_SHIPPING });
    expect(t.subtotalCents).toBe(1000);
    expect(t.shippingCents).toBe(0);
    expect(t.totalCents).toBe(1000);
  });

  it("multiple items and quantities sum correctly", () => {
    const t = computeTotals({
      items: [item(1000, 2), item(500, 3)],
      discount: null,
      shipping: NO_SHIPPING,
    });
    expect(t.subtotalCents).toBe(1000 * 2 + 500 * 3);
  });

  it("VAT is extracted from the total, never added on top (VAT-inclusive pricing)", () => {
    // total 1240 cents at 24% → vat = round(1240*24/124) = 240
    const t = computeTotals({ items: [item(1240)], discount: null, shipping: NO_SHIPPING });
    expect(t.totalCents).toBe(1240);
    expect(t.vatCents).toBe(Math.round((1240 * 24) / 124));
    // The defining VAT-inclusive invariant: subtotal - discount + shipping = total.
    expect(t.subtotalCents - t.discountCents + t.shippingCents).toBe(t.totalCents);
  });

  it("respects a custom vatRate", () => {
    const t = computeTotals({ items: [item(1000)], discount: null, shipping: NO_SHIPPING, vatRate: 13 });
    expect(t.vatRate).toBe(13);
    expect(t.vatCents).toBe(Math.round((1000 * 13) / 113));
  });

  describe("discounts", () => {
    it("percentage discount below the minimum subtotal does not apply", () => {
      const t = computeTotals({
        items: [item(1000)],
        discount: { type: "percentage", value: 10, min_subtotal_cents: 2000 },
        shipping: NO_SHIPPING,
      });
      expect(t.discountCents).toBe(0);
    });

    it("percentage discount applies exactly at the minimum subtotal boundary", () => {
      const t = computeTotals({
        items: [item(2000)],
        discount: { type: "percentage", value: 10, min_subtotal_cents: 2000 },
        shipping: NO_SHIPPING,
      });
      expect(t.discountCents).toBe(200);
    });

    it("fixed discount never turns into a refund (clamped to subtotal)", () => {
      const t = computeTotals({
        items: [item(500)],
        discount: { type: "fixed", value: 2000, min_subtotal_cents: 0 },
        shipping: NO_SHIPPING,
      });
      expect(t.discountCents).toBe(500);
      expect(t.totalCents).toBe(0);
    });

    it("percentage discount rounds to the nearest cent", () => {
      const t = computeTotals({
        items: [item(999)],
        discount: { type: "percentage", value: 10, min_subtotal_cents: 0 },
        shipping: NO_SHIPPING,
      });
      expect(t.discountCents).toBe(Math.round(999 * 0.1));
    });
  });

  describe("shipping", () => {
    it("standard cart pays the method's own price below the free-shipping threshold", () => {
      const t = computeTotals({ items: [item(1000)], discount: null, shipping: STANDARD_SHIPPING });
      expect(t.shippingCents).toBe(350);
    });

    it("standard cart ships free exactly at the free-shipping threshold", () => {
      const t = computeTotals({ items: [item(7900)], discount: null, shipping: STANDARD_SHIPPING });
      expect(t.shippingCents).toBe(0);
    });

    it("store pickup is always free, regardless of items or oversized cost", () => {
      const t = computeTotals({
        items: [item(1000, 1, 5000)],
        discount: null,
        shipping: PICKUP,
      });
      expect(t.shippingCents).toBe(0);
    });

    it("a single heavy item charges its own oversized cost, not the method price", () => {
      const t = computeTotals({
        items: [item(1000, 1, 800)],
        discount: null,
        shipping: STANDARD_SHIPPING,
      });
      expect(t.shippingCents).toBe(800);
    });

    it("mixed heavy + normal items: shipping is the highest single oversized cost, never summed", () => {
      // €7 item + €12 item = 12.00, not 19.00 — the documented business rule.
      const t = computeTotals({
        items: [item(1000, 1, 700), item(1000, 1, 1200)],
        discount: null,
        shipping: STANDARD_SHIPPING,
      });
      expect(t.shippingCents).toBe(1200);
    });

    it("two of the same heavy item still pays the surcharge once, not per unit", () => {
      const t = computeTotals({
        items: [item(1000, 3, 800)],
        discount: null,
        shipping: STANDARD_SHIPPING,
      });
      expect(t.shippingCents).toBe(800);
    });

    it("nationwide free-shipping threshold does NOT waive an oversized item's cost", () => {
      const t = computeTotals({
        items: [item(8000, 1, 800)],
        discount: null,
        shipping: STANDARD_SHIPPING, // afterDiscount (8000) already clears free_over_cents (7900)
      });
      expect(t.shippingCents).toBe(800);
    });

    it("Heraklion's free-shipping threshold DOES cover an oversized item once met", () => {
      const t = computeTotals({
        items: [item(3000, 1, 800)],
        discount: null,
        shipping: HERAKLION_SHIPPING, // afterDiscount (3000) clears free_over_cents (3000)
      });
      expect(t.shippingCents).toBe(0);
    });

    it("Heraklion oversized item still charges when below its own threshold", () => {
      const t = computeTotals({
        items: [item(1000, 1, 800)],
        discount: null,
        shipping: HERAKLION_SHIPPING, // 1000 < 3000 threshold
      });
      expect(t.shippingCents).toBe(800);
    });
  });
});

// SPD-09: the browser's prediction after an optimistic edit. Expected figures
// are worked out by hand in each comment, not taken from computeTotals, so a
// wrong input mapping (a rule dropped, a price off by a cent) shows up here.
describe("recomputeTotals", () => {
  const TEN_PERCENT_OVER_30 = { type: "percentage" as const, value: 10, min_subtotal_cents: 3000 };

  function line(id: string, unitCents: number, quantity: number, shippingCostCents: number | null = null): CartLineItem {
    return {
      id,
      variantId: `v-${id}`,
      productHandle: id,
      title: id,
      quantity,
      unitPrice: { amount: unitCents / 100, currencyCode: "EUR" },
      lineTotal: { amount: 0, currencyCode: "EUR" }, // stale on purpose — must be rebuilt
      placeholderTone: "clay",
      imageUrl: null,
      code: null,
      hasExtraShipping: (shippingCostCents ?? 0) > 0,
      shippingCostCents,
      stockQuantity: 99,
      allowBackorder: false,
    };
  }

  // Money fields deliberately wrong: everything recomputeTotals returns has
  // to come from the lines and `pricing`, never from the stale snapshot.
  function cartWith(items: CartLineItem[], pricing: Cart["pricing"]): Cart {
    const stale = { amount: -1, currencyCode: "EUR" as const };
    return {
      id: "c1",
      items,
      itemCount: -1,
      subtotal: stale,
      discountTotal: stale,
      shippingTotal: stale,
      vatTotal: stale,
      vatRate: 24,
      hasShippingMethod: pricing.shipping != null,
      total: stale,
      pricing,
      promotions: [],
      taxDocumentType: "receipt",
      fetchedAt: 1,
    };
  }

  const amounts = (c: Cart) => ({
    itemCount: c.itemCount,
    subtotal: c.subtotal.amount,
    discount: c.discountTotal.amount,
    shipping: c.shippingTotal.amount,
    vat: c.vatTotal.amount,
    total: c.total.amount,
  });

  it("prices a cart below the discount's minimum: no discount, flat shipping", () => {
    // 24.50 < 30 minimum → no discount; 3.50 shipping; 28.00 total;
    // ΦΠΑ 2800 × 24 / 124 = 541.9 → 5.42.
    const c = recomputeTotals(cartWith([line("a", 2450, 1)], { discount: TEN_PERCENT_OVER_30, shipping: STANDARD_SHIPPING }));
    expect(amounts(c)).toEqual({ itemCount: 1, subtotal: 24.5, discount: 0, shipping: 3.5, vat: 5.42, total: 28 });
    expect(c.items[0].lineTotal.amount).toBe(24.5);
  });

  it("switches the discount on when a quantity change crosses its minimum", () => {
    // 2 × 24.50 = 49.00 ≥ 30 → −4.90; 44.10 < 79 → 3.50; 47.60 total;
    // ΦΠΑ 4760 × 24 / 124 = 921.3 → 9.21.
    const c = recomputeTotals(cartWith([line("a", 2450, 2)], { discount: TEN_PERCENT_OVER_30, shipping: STANDARD_SHIPPING }));
    expect(amounts(c)).toEqual({ itemCount: 2, subtotal: 49, discount: 4.9, shipping: 3.5, vat: 9.21, total: 47.6 });
    expect(c.items[0].lineTotal.amount).toBe(49);
  });

  it("waives shipping when the quantity change crosses the free-shipping threshold", () => {
    // 4 × 24.50 = 98.00 → −9.80 → 88.20 ≥ 79 → free; ΦΠΑ 8820 × 24 / 124 = 1707.1 → 17.07.
    const c = recomputeTotals(cartWith([line("a", 2450, 4)], { discount: TEN_PERCENT_OVER_30, shipping: STANDARD_SHIPPING }));
    expect(amounts(c)).toEqual({ itemCount: 4, subtotal: 98, discount: 9.8, shipping: 0, vat: 17.07, total: 88.2 });
  });

  it("keeps an oversized item's surcharge over the nationwide threshold", () => {
    // 90.00 + 10.00 = 100.00 ≥ 79, but the €8 item's own cost still applies → 108.00.
    const c = recomputeTotals(
      cartWith([line("a", 9000, 1), line("b", 1000, 1, 800)], { discount: null, shipping: STANDARD_SHIPPING })
    );
    expect(c.shippingTotal.amount).toBe(8);
    expect(c.total.amount).toBe(108);
    expect(c.itemCount).toBe(2);
  });

  it("returns zero totals once the last line is removed (no shipping method saved)", () => {
    const c = recomputeTotals(cartWith([], { discount: TEN_PERCENT_OVER_30, shipping: null }));
    expect(amounts(c)).toEqual({ itemCount: 0, subtotal: 0, discount: 0, shipping: 0, vat: 0, total: 0 });
  });

  it("recovers exact cents from the euro amounts (no float drift)", () => {
    // 0.1 × 3 in floating point is 0.30000000000000004; in cents it is 30.
    const c = recomputeTotals(cartWith([line("a", 10, 3)], { discount: null, shipping: null }));
    expect(c.items[0].lineTotal.amount).toBe(0.3);
    expect(c.subtotal.amount).toBe(0.3);
  });

  it("changes nothing but the money fields, the line totals and the item count", () => {
    const before = cartWith([line("a", 2450, 1)], { discount: null, shipping: PICKUP });
    const after = recomputeTotals(before);
    expect({ ...after, items: [], itemCount: 0, subtotal: 0, discountTotal: 0, shippingTotal: 0, vatTotal: 0, total: 0 }).toEqual({
      ...before,
      items: [],
      itemCount: 0,
      subtotal: 0,
      discountTotal: 0,
      shippingTotal: 0,
      vatTotal: 0,
      total: 0,
    });
    expect({ ...after.items[0], lineTotal: null }).toEqual({ ...before.items[0], lineTotal: null });
  });
});
