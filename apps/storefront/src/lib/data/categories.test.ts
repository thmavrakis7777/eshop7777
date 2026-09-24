import { describe, it, expect } from "vitest";
import { toMenuCategories } from "./categories";
import type { CategoryNode, NavCategory } from "@/lib/types";

// SPD-05: the header/mobile menu get a slim copy of the nav tree because
// everything handed to those client components ships in every page's RSC
// payload. toMenuCategories is pure (it maps getNavCategories()' result), so
// no database is needed — same pattern as catalog.test.ts.

function node(handle: string, overrides: Partial<CategoryNode> = {}): CategoryNode {
  return {
    id: `id-${handle}`,
    name: handle.toUpperCase(),
    handle,
    description: "long SEO description that must not reach the client",
    pageType: "products",
    imagePath: "categories/x.jpg",
    faq: [{ question: "q", answer: "a" }],
    mobileViewAllButton: { enabled: true, text: "Δείτε όλα", position: "bottom" },
    children: [],
    displayChildren: [],
    productCount: 3,
    canonicalHref: `/${handle}`,
    ...overrides,
  };
}

describe("toMenuCategories", () => {
  it("keeps only the fields the menus read, recursively", () => {
    const leaf = node("tigania", { canonicalHref: "/kouzina/tigania" });
    const root: NavCategory = {
      ...node("kouzina", { children: [leaf], displayChildren: [leaf] }),
      promo: { imagePath: null, title: "Promo", description: "d", buttonText: "Δες", href: "/kouzina" },
    };

    const [menu] = toMenuCategories([root]);

    expect(menu).toEqual({
      name: "KOUZINA",
      handle: "kouzina",
      canonicalHref: "/kouzina",
      mobileViewAllButton: { enabled: true, text: "Δείτε όλα", position: "bottom" },
      promo: root.promo,
      displayChildren: [
        {
          name: "TIGANIA",
          handle: "tigania",
          canonicalHref: "/kouzina/tigania",
          mobileViewAllButton: { enabled: true, text: "Δείτε όλα", position: "bottom" },
          displayChildren: [],
        },
      ],
    });
  });

  it("maps a cross-listed category once, shared under every parent", () => {
    const shared = node("maxairia");
    const a: NavCategory = { ...node("kouzina", { displayChildren: [shared] }), promo: undefined };
    const b: NavCategory = { ...node("ergaleia", { displayChildren: [shared] }), promo: undefined };

    const [menuA, menuB] = toMenuCategories([a, b]);

    expect(menuA.displayChildren[0]).toBe(menuB.displayChildren[0]);
  });

  it("terminates on a secondary-parent cycle instead of recursing forever", () => {
    const parent = node("kouzina");
    const child = node("tigania", { displayChildren: [parent] });
    parent.displayChildren = [child];

    const [menu] = toMenuCategories([{ ...parent, promo: undefined }]);

    expect(menu.displayChildren[0].handle).toBe("tigania");
    expect(menu.displayChildren[0].displayChildren[0].handle).toBe("kouzina");
  });
});
