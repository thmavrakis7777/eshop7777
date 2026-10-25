import { describe, expect, it } from "vitest";
import { activeFilterChips, keepSaleFilter } from "./active-filters";
import type { CategoryFacets } from "@/lib/data/products";

const facets: CategoryFacets = {
  priceMinCents: 100,
  priceMaxCents: 16900,
  hasOutOfStock: true,
  materials: ["Εμαγιέ", "Μεταλλικό"],
  origins: [{ code: "GR", label: "Ελλάδα" }],
};

describe("activeFilterChips", () => {
  it("offers a single «Προσφορές» chip that goes back to the plain category URL", () => {
    expect(activeFilterChips({ saleOnly: true }, facets, "/ygraerio", "newest")).toEqual({
      chips: [{ label: "Προσφορές", href: "/ygraerio" }],
      clearHref: null,
    });
  });

  it("removes one value at a time and keeps the rest and the sort", () => {
    const { chips, clearHref } = activeFilterChips(
      { saleOnly: true, material: ["Εμαγιέ", "Μεταλλικό"], origin: ["GR"] },
      facets,
      "/ygraerio",
      "price-asc"
    );
    expect(chips.map((c) => c.label)).toEqual(["Προσφορές", "Υλικό: Εμαγιέ", "Υλικό: Μεταλλικό", "Προέλευση: Ελλάδα"]);
    const emayie = new URL(chips[1].href, "https://x");
    expect(emayie.pathname).toBe("/ygraerio");
    expect(emayie.searchParams.getAll("material")).toEqual(["Μεταλλικό"]);
    expect(emayie.searchParams.get("sale")).toBe("1");
    expect(emayie.searchParams.get("origin")).toBe("GR");
    expect(emayie.searchParams.get("sort")).toBe("price-asc");
    expect(clearHref).toBe("/ygraerio?sort=price-asc");
  });

  it("labels a price range, a lower bound and an upper bound", () => {
    const label = (f: Parameters<typeof activeFilterChips>[0]) =>
      activeFilterChips(f, facets, "/k", "newest").chips[0].label;
    expect(label({ minPriceCents: 1000, maxPriceCents: 5050 })).toBe("Τιμή: 10–50,5 €");
    expect(label({ minPriceCents: 1000 })).toBe("Τιμή: από 10 €");
    expect(label({ maxPriceCents: 5000 })).toBe("Τιμή: έως 50 €");
  });

  it("shows nothing when no filter is set", () => {
    expect(activeFilterChips({}, facets, "/k", "newest")).toEqual({ chips: [], clearHref: null });
  });
});

describe("keepSaleFilter", () => {
  it("carries ?sale=1 into a child category only in offers mode", () => {
    expect(keepSaleFilter("/ygraerio/kamineta-ygraeriou", { saleOnly: true })).toBe("/ygraerio/kamineta-ygraeriou?sale=1");
    expect(keepSaleFilter("/ygraerio/kamineta-ygraeriou", { material: ["Εμαγιέ"] })).toBe("/ygraerio/kamineta-ygraeriou");
  });
});
