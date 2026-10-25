import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, clearedFilterUrl, filterDraftUrl, type CategoryFilterOptions } from "./category-filter";
import { countActiveFilters, filtersToSearchEntries, parseFilters } from "./search-params";
import { activeFilterChips } from "./active-filters";

const decoded = (url: string) => decodeURIComponent(url);

describe("filterDraftUrl", () => {
  it("ticks several values in one group and combines groups", () => {
    const url = filterDraftUrl("/ygraerio", new URLSearchParams("sale=1&page=3"), {
      ...EMPTY_DRAFT,
      material: ["Ανοξείδωτο", "Πλαστικό"],
      categories: ["kamineta-ygraeriou", "antallaktika-ygraeriou"],
      inStock: true,
      priceMax: "30",
    });
    expect(decoded(url)).toBe(
      "/filtra/ygraerio?sale=1&price_max=30&in_stock=1&material=Ανοξείδωτο&material=Πλαστικό&cat=kamineta-ygraeriou&cat=antallaktika-ygraeriou"
    );
  });

  describe("on a subcategory (siblings mode)", () => {
    const siblings: CategoryFilterOptions = {
      mode: "siblings",
      options: [],
      selected: ["kamineta-ygraeriou"],
      currentSlug: "kamineta-ygraeriou",
      parentPath: "/ygraerio",
    };

    it("stays on its own page while only it is ticked", () => {
      const url = filterDraftUrl("/ygraerio/kamineta-ygraeriou", new URLSearchParams("sale=1"), {
        ...EMPTY_DRAFT,
        categories: ["kamineta-ygraeriou"],
        material: ["Πλαστικό"],
      }, siblings);
      expect(decoded(url)).toBe("/filtra/ygraerio/kamineta-ygraeriou?sale=1&material=Πλαστικό");
    });

    it("moves to the parent with both ticked when a sibling is added", () => {
      const url = filterDraftUrl("/ygraerio/kamineta-ygraeriou", new URLSearchParams(), {
        ...EMPTY_DRAFT,
        categories: ["kamineta-ygraeriou", "antallaktika-ygraeriou"],
      }, siblings);
      expect(url).toBe("/filtra/ygraerio?cat=kamineta-ygraeriou&cat=antallaktika-ygraeriou");
    });

    it("goes to the whole parent when everything is unticked", () => {
      expect(filterDraftUrl("/ygraerio/kamineta-ygraeriou", new URLSearchParams(), EMPTY_DRAFT, siblings)).toBe("/ygraerio");
    });
  });
});

describe("clearedFilterUrl", () => {
  it("drops the form's filters and the page, keeps the offers and the sort", () => {
    expect(
      clearedFilterUrl("/ygraerio", new URLSearchParams("sale=1&sort=price-asc&material=Εμαγιέ&cat=x&page=2"))
    ).toBe("/filtra/ygraerio?sale=1&sort=price-asc");
  });
});

describe("?cat= parsing", () => {
  const facets = { priceMinCents: null, priceMaxCents: null, hasOutOfStock: false, materials: [], origins: [] };

  it("keeps only the category's own subcategories, once each", () => {
    const f = parseFilters({ cat: ["kamineta-ygraeriou", "kouzina", "kamineta-ygraeriou", "antallaktika-ygraeriou"] }, facets, [
      "kamineta-ygraeriou",
      "antallaktika-ygraeriou",
    ]);
    expect(f.categories).toEqual(["kamineta-ygraeriou", "antallaktika-ygraeriou"]);
    expect(countActiveFilters(f)).toBe(1);
    expect(filtersToSearchEntries(f)).toEqual([
      ["cat", "kamineta-ygraeriou"],
      ["cat", "antallaktika-ygraeriou"],
    ]);
  });

  it("ignores ?cat= where no subcategory is allowed", () => {
    expect(parseFilters({ cat: "kamineta-ygraeriou" }, facets).categories).toBeUndefined();
  });
});

describe("category chips", () => {
  it("names each ticked category and removes one at a time", () => {
    const { chips } = activeFilterChips(
      { categories: ["kamineta-ygraeriou", "antallaktika-ygraeriou"] },
      { priceMinCents: null, priceMaxCents: null, hasOutOfStock: false, materials: [], origins: [] },
      "/ygraerio",
      "newest",
      { "kamineta-ygraeriou": "Καμινέτα", "antallaktika-ygraeriou": "Ανταλλακτικά" }
    );
    expect(chips).toEqual([
      { label: "Καμινέτα", href: "/filtra/ygraerio?cat=antallaktika-ygraeriou" },
      { label: "Ανταλλακτικά", href: "/filtra/ygraerio?cat=kamineta-ygraeriou" },
    ]);
  });
});
