import { describe, it, expect } from "vitest";
import { toDomainProduct } from "./catalog";

// QA-012: the "Νέες αφίξεις" window is now admin-configurable
// (newArrivalWindowDays), not the hardcoded 30 this replaces. toDomainProduct
// is the one place that decides the "new" badge in JS (mirroring
// NEW_ARRIVAL_PREDICATE's SQL), so exercising it here covers every caller —
// no database needed, matching cart.test.ts's pattern for this file's
// sibling pure logic.

function row(overrides: Partial<{ createdAt: Date; isNewOverride: boolean }> = {}) {
  const { createdAt = new Date(), isNewOverride = false } = overrides;
  return {
    id: "p1",
    slug: "test-product",
    title: "Test Product",
    description: null,
    created_at: createdAt,
    is_new_override: isNewOverride,
    material: null,
    weight_grams: null,
    length_cm: null,
    width_cm: null,
    height_cm: null,
    origin_country: null,
    category_slug: null,
    image_path: null,
    variants: [
      {
        id: "v1",
        title: "Default",
        sku: "SKU-1",
        price_cents: 1000,
        compare_at_price_cents: null,
        stock_quantity: 5,
        allow_backorder: false,
      },
    ],
    min_price_cents: 1000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("toDomainProduct — new-arrival badge", () => {
  it("a product created just now is new, within a 30-day window", () => {
    const p = toDomainProduct(row({ createdAt: daysAgo(0) }), 30);
    expect(p.badges).toContain("new");
  });

  it("a product created well within the window is new", () => {
    const p = toDomainProduct(row({ createdAt: daysAgo(10) }), 30);
    expect(p.badges).toContain("new");
  });

  it("a product created well past the window is not new", () => {
    const p = toDomainProduct(row({ createdAt: daysAgo(60) }), 30);
    expect(p.badges).not.toContain("new");
  });

  it("is_new_override marks a product new regardless of age", () => {
    const p = toDomainProduct(row({ createdAt: daysAgo(365), isNewOverride: true }), 30);
    expect(p.badges).toContain("new");
  });

  it("the window is the admin-configured value, not a hardcoded 30", () => {
    // 10 days old: new under the default 30-day window...
    const wide = toDomainProduct(row({ createdAt: daysAgo(10) }), 30);
    expect(wide.badges).toContain("new");

    // ...but not once an admin narrows the window to 5 days.
    const narrow = toDomainProduct(row({ createdAt: daysAgo(10) }), 5);
    expect(narrow.badges).not.toContain("new");
  });
});
