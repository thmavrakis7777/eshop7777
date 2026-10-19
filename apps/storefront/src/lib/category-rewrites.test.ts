import { describe, it, expect } from "vitest";
// @ts-expect-error -- Next ships its compiled copy without type declarations.
import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
import { buildCategoryQueryRewrites, reservedFirstSegments } from "@/lib/category-rewrites";
import { CATEGORY_QUERY_KEYS } from "@/lib/search-params";

/**
 * These rules decide whether a URL gets the cached category page or the
 * uncached filtered one (PAGE_CACHING_SPEC.md, B3). Getting them wrong fails
 * silently: a sort that shows unsorted products, or a journal/collection
 * page 2 that 404s because it was sent to a category lookup. The patterns
 * are compiled with the same path-to-regexp build Next uses.
 */

const reserved = reservedFirstSegments([
  "(storefront)",
  "[category]",
  "admin",
  "api",
  "journal",
  "syllogi",
  "proionta",
  "nea-afiksi",
  "filtra",
]);
const rules = buildCategoryQueryRewrites(CATEGORY_QUERY_KEYS, reserved);

/** The destination a path would be rewritten to, given its query keys. */
function rewrite(path: string, queryKeys: string[]): string | null {
  for (const rule of rules) {
    if (!rule.has.every((h) => queryKeys.includes(h.key))) continue;
    const keys: { name: string | number }[] = [];
    const match = pathToRegexp(rule.source, keys).exec(path);
    if (!match) continue;
    let dest = rule.destination;
    keys.forEach((k, i) => (dest = dest.replace(`:${k.name}`, match[i + 1])));
    return dest;
  }
  return null;
}

describe("buildCategoryQueryRewrites", () => {
  it("sends sorted, paged and filtered category URLs at every depth to /filtra", () => {
    expect(rewrite("/kouzina", ["sort"])).toBe("/filtra/kouzina");
    expect(rewrite("/kouzina/ergaleia-kouzinas", ["page"])).toBe("/filtra/kouzina/ergaleia-kouzinas");
    expect(rewrite("/ygraerio/rythmistes/xamilis-piesis", ["material"])).toBe(
      "/filtra/ygraerio/rythmistes/xamilis-piesis"
    );
    for (const key of CATEGORY_QUERY_KEYS) expect(rewrite("/kouzina", [key])).toBe("/filtra/kouzina");
  });

  it("leaves a plain category URL, or one with only tracking parameters, on the cached page", () => {
    expect(rewrite("/kouzina", [])).toBeNull();
    expect(rewrite("/kouzina", ["utm_source", "fbclid", "gclid"])).toBeNull();
  });

  it("never touches the app's own routes, including their paged views", () => {
    expect(rewrite("/journal", ["page"])).toBeNull();
    expect(rewrite("/journal/kategoria/odigoi", ["page"])).toBeNull();
    expect(rewrite("/syllogi/xristougenna", ["page", "sort"])).toBeNull();
    expect(rewrite("/nea-afiksi", ["sort"])).toBeNull();
    expect(rewrite("/proionta/lampa", ["sort"])).toBeNull();
    expect(rewrite("/admin/products", ["page"])).toBeNull();
    expect(rewrite("/filtra/kouzina", ["sort"])).toBeNull();
  });

  it("only excludes whole segments, so a category starting with a route's name still works", () => {
    expect(rewrite("/journalistika", ["sort"])).toBe("/filtra/journalistika");
  });

  it("keeps files and framework paths out", () => {
    expect(rewrite("/sitemap.xml", ["page"])).toBeNull();
    expect(rewrite("/_next/data", ["page"])).toBeNull();
  });
});

describe("reservedFirstSegments", () => {
  it("skips route groups and dynamic segments and adds framework paths", () => {
    const r = reservedFirstSegments(["(storefront)", "[category]", "journal"]);
    expect(r).toContain("journal");
    expect(r).toContain("_next");
    expect(r).not.toContain("(storefront)");
    expect(r).not.toContain("[category]");
  });
});
