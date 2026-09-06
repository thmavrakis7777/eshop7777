import { describe, it, expect } from "vitest";
import { computeTotals } from "./cart";

// Exercises the real production computeTotals (lib/db/cart.ts) — no mirror,
// no copy of the pricing formula. Pure and dependency-free by design (see
// its own comment), so no database or mocking is needed; vitest.config.ts
// documents why the module still loads cleanly despite `server-only`.

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
