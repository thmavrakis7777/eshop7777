/**
 * Where «Συνέχεια αγορών» goes: the last shopping page the visitor was on —
 * a product, or a listing with its filters, offers and sort (/filtra/…?…) —
 * and how far down it they were, instead of the top of the homepage.
 * Listings and product pages record themselves (RememberShoppingPage); the
 * cart, checkout, account and info pages never do, so continuing from them
 * returns to the shop, not to them.
 *
 * localStorage, not sessionStorage: "where they were last time" should
 * survive closing the tab and coming back to the cart later. It expires
 * after 30 days so an old link to a page that has since changed is not
 * offered forever. Same-site paths only — anything else falls back to "/".
 */
const KEY = "mh:last-shopping-page";
const RESTORE_KEY = "mh:restore-scroll";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type ShoppingPosition = {
  /** Window scroll position. */
  y: number;
  /**
   * On a product listing: the product card at the top of the screen and
   * how far below the top of the window it sat. Restoring by card rather
   * than by pixels survives images loading at a different pace, and tells
   * an infinite-scroll list how many batches it has to load again.
   */
  anchor?: { href: string; top: number };
};

type Stored = { url: string; at: number } & Partial<ShoppingPosition>;

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Stored>;
    if (typeof s.url !== "string" || !isSitePath(s.url)) return null;
    if (typeof s.at !== "number" || Date.now() - s.at > MAX_AGE_MS) return null;
    return s as Stored;
  } catch {
    return null;
  }
}

function write(s: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: «Συνέχεια αγορών» simply goes home.
  }
}

/** This page is now the one to continue on (its saved position kept if it already was). */
export function rememberShoppingPage(url: string): void {
  if (!isSitePath(url)) return;
  const current = read();
  write(current?.url === url ? { ...current, at: Date.now() } : { url, at: Date.now() });
}

/** How far down the remembered page the shopper is — ignored for any other page. */
export function rememberShoppingPosition(url: string, position: ShoppingPosition): void {
  const current = read();
  if (current?.url !== url) return;
  write({ url, at: Date.now(), ...position });
}

/** The page to continue shopping on, or "/" when none is known. */
export function lastShoppingPage(): string {
  return read()?.url ?? "/";
}

/**
 * Called by «Συνέχεια αγορών» just before it navigates: the page that
 * opens next restores the saved position. One-shot and per tab (session),
 * so a plain visit to the same page — a menu link, a shared URL — still
 * opens at the top.
 */
export function markScrollRestore(url: string): void {
  try {
    sessionStorage.setItem(RESTORE_KEY, url);
  } catch {
    // Storage blocked: the page opens at the top.
  }
}

/** The saved position if this page was opened by «Συνέχεια αγορών»; clears the mark. */
export function takeScrollRestore(url: string): ShoppingPosition | null {
  try {
    if (sessionStorage.getItem(RESTORE_KEY) !== url) return null;
    sessionStorage.removeItem(RESTORE_KEY);
  } catch {
    return null;
  }
  const s = read();
  if (s?.url !== url || typeof s.y !== "number") return null;
  return { y: s.y, ...(s.anchor ? { anchor: s.anchor } : {}) };
}

// A path on this site: one leading slash, never "//host" or "/\host",
// which a browser would treat as another site.
export function isSitePath(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\");
}
