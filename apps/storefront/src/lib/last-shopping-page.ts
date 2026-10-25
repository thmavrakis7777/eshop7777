/**
 * Where «Συνέχεια αγορών» goes: the last shopping page the visitor was on —
 * a product, or a listing with its filters, offers and sort (/filtra/…?…) —
 * instead of the homepage. Listings and product pages record themselves
 * (RememberShoppingPage); the cart, checkout, account and info pages never
 * do, so continuing from them returns to the shop, not to them.
 *
 * localStorage, not sessionStorage: "where they were last time" should
 * survive closing the tab and coming back to the cart later. It expires
 * after 30 days so an old link to a page that has since changed is not
 * offered forever. Same-site paths only — anything else falls back to "/".
 */
const KEY = "mh:last-shopping-page";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function rememberShoppingPage(url: string): void {
  if (!isSitePath(url)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ url, at: Date.now() }));
  } catch {
    // Storage blocked: «Συνέχεια αγορών» simply goes home.
  }
}

/** The page to continue shopping on, or "/" when none is known. */
export function lastShoppingPage(): string {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return "/";
    const { url, at } = JSON.parse(raw) as { url?: unknown; at?: unknown };
    if (typeof url !== "string" || !isSitePath(url)) return "/";
    if (typeof at !== "number" || Date.now() - at > MAX_AGE_MS) return "/";
    return url;
  } catch {
    return "/";
  }
}

// A path on this site: one leading slash, never "//host" or "/\host",
// which a browser would treat as another site.
export function isSitePath(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\");
}
