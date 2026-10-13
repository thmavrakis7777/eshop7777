import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryNode } from "@/lib/types";

// app/sitemap.ts with its data layer replaced, so this checks only what the
// sitemap does with the rows: no database, as for every test here.
const data = vi.hoisted(() => ({
  navCategories: [] as unknown[],
  categoryLastModified: new Map<string, Date>(),
  noindexCategoryIds: new Set<string>(),
  products: [] as { handle: string; updatedAt: string }[],
  fail: false,
}));

vi.mock("@/lib/data/categories", () => ({
  getNavCategories: async () => {
    if (data.fail) throw new Error("database unreachable");
    return data.navCategories;
  },
  getCategoryLastModified: async () => data.categoryLastModified,
  getNoindexCategoryIds: async () => data.noindexCategoryIds,
}));
vi.mock("@/lib/data/products", () => ({
  getAllProductHandles: async () => data.products,
  getAllCollectionHandles: async () => [],
}));
vi.mock("@/lib/data/content-pages", () => ({ getContentPage: async () => null }));
vi.mock("@/lib/data/journal", () => ({ getJournalSitemapEntries: async () => ({ categories: [], articles: [] }) }));

const sitemapModule = await import("@/app/sitemap");
const sitemap = sitemapModule.default;

function node(id: string, handle: string, productCount: number, children: CategoryNode[] = []): CategoryNode {
  return { id, handle, pageType: "products", productCount, children } as unknown as CategoryNode;
}

const paths = (entries: { url: string }[]) => entries.map((e) => new URL(e.url).pathname);

beforeEach(() => {
  data.navCategories = [];
  data.categoryLastModified = new Map();
  data.noindexCategoryIds = new Set();
  data.products = [];
  data.fail = false;
});

describe("sitemap", () => {
  it("is built on every request, never a cached copy", () => {
    // A cached (ISR) sitemap kept serving its build-time copy in production
    // for days; see the note in app/sitemap.ts.
    expect(sitemapModule.dynamic).toBe("force-dynamic");
    expect("revalidate" in sitemapModule).toBe(false);
  });

  it("lists every product it is given, with the product's own lastmod", async () => {
    data.products = [
      { handle: "kamineto-a", updatedAt: "2026-10-10T17:32:13.100Z" },
      { handle: "petrogkaz-b", updatedAt: "2026-10-12T14:06:56.618Z" },
    ];
    const entries = await sitemap();
    const product = entries.find((e) => e.url.endsWith("/proionta/petrogkaz-b"));
    expect(product?.lastModified).toBe("2026-10-12T14:06:56.618Z");
    expect(paths(entries)).toContain("/proionta/kamineto-a");
  });

  it("leaves out empty and noindex categories, but still walks below them", async () => {
    const lastmod = new Date("2026-10-09T11:12:21.455Z");
    data.navCategories = [
      node("root", "ygraerio", 3, [
        node("hidden", "kamineta", 2, [node("leaf", "mikra", 2)]),
        node("empty", "kouzinakia", 0),
      ]),
    ];
    data.noindexCategoryIds = new Set(["hidden"]);
    data.categoryLastModified = new Map([["leaf", lastmod]]);

    const entries = await sitemap();
    const listed = paths(entries);
    expect(listed).toContain("/ygraerio");
    expect(listed).not.toContain("/ygraerio/kamineta");
    expect(listed).not.toContain("/ygraerio/kouzinakia");
    expect(entries.find((e) => e.url.endsWith("/ygraerio/kamineta/mikra"))?.lastModified).toBe(lastmod);
  });

  it("falls back to the fixed pages when the database is unreachable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    data.fail = true;
    const listed = paths(await sitemap());
    expect(listed).toContain("/prosfores");
    expect(listed.some((p) => p.startsWith("/proionta/"))).toBe(false);
  });
});
