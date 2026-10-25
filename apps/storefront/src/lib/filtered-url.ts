/**
 * Where a category listing with a query string (filters, offers, sort)
 * lives in the address bar: /filtra/ygraerio?sale=1, not /ygraerio?sale=1.
 *
 * Why the visible /filtra prefix: the plain category page (/ygraerio) is a
 * static, cached page that never reads the query string. Next's client
 * router knows that, so when a link or router.push changes only the query
 * string of /ygraerio, it reuses the copy of /ygraerio it already holds
 * (from an earlier visit or a hover prefetch) and never asks the server —
 * the next.config.ts rewrite to /filtra never runs, and the shopper sees the
 * unfiltered page under a filtered URL (confirmed live, 25 Οκτ 2026, from
 * the menu's «Προσφορές Εβδομάδας!» tile and from the filter tick boxes).
 * Navigating to /filtra/… is a different, per-request route, so the router
 * always fetches it.
 *
 * The rewrite stays for every /ygraerio?… URL that arrives as a real
 * request (typed, shared, bookmarked, crawled); canonical and robots come
 * from the category's own path either way (lib/category-route.ts).
 *
 * Dependency-free: imported by client and server code alike.
 */
const FILTERED_PREFIX = "/filtra";

/** A category listing URL: the cached plain page with no query, /filtra/… with one. */
export function categoryListingUrl(categoryPath: string, query: URLSearchParams | string): string {
  const qs = typeof query === "string" ? query : query.toString();
  return qs ? `${FILTERED_PREFIX}${categoryPath}?${qs}` : categoryPath;
}

/** The category's own path from the current pathname, with or without /filtra. */
export function categoryPathOf(pathname: string): string {
  return pathname.startsWith(`${FILTERED_PREFIX}/`) ? pathname.slice(FILTERED_PREFIX.length) : pathname;
}
