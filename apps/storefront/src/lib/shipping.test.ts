import { describe, it, expect } from "vitest";
import { highestOversizedFeeCents } from "./shipping";

// The exact rule shared by computeTotals (server, real charge) and
// ShippingSection.tsx (client, checkout-UI preview) — see shipping.ts's own
// comment for why "highest single item, never summed" is the real business
// rule, not an approximation.

describe("highestOversizedFeeCents", () => {
  it("an all-standard cart (no oversized costs) resolves to 0", () => {
    expect(highestOversizedFeeCents([null, null, undefined])).toBe(0);
  });

  it("an empty cart resolves to 0", () => {
    expect(highestOversizedFeeCents([])).toBe(0);
  });

  it("a single oversized item returns its own cost", () => {
    expect(highestOversizedFeeCents([800])).toBe(800);
  });

  it("mixed oversized costs return the highest, not the sum", () => {
    expect(highestOversizedFeeCents([700, 1200, null])).toBe(1200);
  });

  it("the documented example: a €7 item and a €12 item pay €12, not €19", () => {
    expect(highestOversizedFeeCents([700, 1200])).toBe(1200);
  });

  it("three of the same heavy item still resolves to that one cost, not 3x", () => {
    expect(highestOversizedFeeCents([800, 800, 800])).toBe(800);
  });

  it("zero counts the same as no surcharge", () => {
    expect(highestOversizedFeeCents([0, 500])).toBe(500);
  });
});
