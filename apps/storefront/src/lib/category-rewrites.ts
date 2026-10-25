/**
 * Rewrites that send a category URL with a listing query string to the
 * uncached copy of the category route under /filtra (PAGE_CACHING_SPEC.md, B3).
 *
 * Why: a page that reads `searchParams` renders on every request, even when
 * the URL has no query string at all. So the category pages themselves no
 * longer read it and are cached (ISR), and only the URLs that actually carry
 * a sort, page or filter — a small share of visits — are rendered per
 * request, by app/(storefront)/filtra/**. The rewrite covers real requests
 * (typed, shared, crawled URLs). The shop's own filter links go to /filtra/…
 * directly instead, because a client-side navigation that only changes the
 * query string of a cached page never reaches this rewrite
 * (lib/filtered-url.ts). Canonical URLs never show /filtra.
 *
 * `afterFiles`: checked after real files and static routes but before
 * dynamic routes, so /kouzina?sort=… is caught before [category] would
 * answer it with the cached, unsorted page.
 *
 * The first segment must not be one of the app's own top-level routes, or
 * /journal/kategoria/x?page=2 or /syllogi/x?page=2 would be sent to a
 * category lookup and 404. That list is read from the app folder at build
 * time (next.config.ts), so a new top-level route is excluded automatically.
 *
 * Dependency-free on purpose: next.config.ts imports it.
 */

type Rewrite = {
  source: string;
  destination: string;
  has: Array<{ type: "query"; key: string }>;
};

// Category slugs are lowercase latin with hyphens; `[^/.]` also keeps files
// such as /robots.txt or /sitemap.xml out of the first segment.
const escapeForRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildCategoryQueryRewrites(
  queryKeys: readonly string[],
  reservedFirstSegments: readonly string[]
): Rewrite[] {
  const reserved = [...new Set(reservedFirstSegments)].map(escapeForRegex).join("|");
  // The lookahead ends in (?:/|$), not $: this pattern sits inside the
  // whole path's regex, where $ is the end of the URL, not of the segment.
  const first = `:category((?!(?:${reserved})(?:/|$))[^/.]+)`;
  const depths = [
    { source: `/${first}`, destination: "/filtra/:category" },
    { source: `/${first}/:subcategory`, destination: "/filtra/:category/:subcategory" },
    {
      source: `/${first}/:subcategory/:subsubcategory`,
      destination: "/filtra/:category/:subcategory/:subsubcategory",
    },
  ];
  // One rule per depth and key: `has` matches a single key, and a URL with
  // any one of them must be rewritten. The rewrite keeps the query string.
  return depths.flatMap((d) => queryKeys.map((key) => ({ ...d, has: [{ type: "query" as const, key }] })));
}

/**
 * The first URL segments that belong to the app itself rather than to a
 * category: every folder under app/ and app/(storefront)/, with route
 * groups and dynamic segments skipped, plus framework paths that have no
 * folder.
 */
export function reservedFirstSegments(folderNames: readonly string[]): string[] {
  const own = folderNames.filter((n) => !n.startsWith("(") && !n.startsWith("[") && !n.startsWith("_"));
  return [...own, "_next", "_vercel"];
}
