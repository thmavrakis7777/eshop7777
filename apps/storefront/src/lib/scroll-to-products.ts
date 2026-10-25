/**
 * "Open the filtered result where the products start." The filter controls
 * call markScrollToProducts() and navigate with `scroll: false`; the listing
 * that renders next (ScrollToProducts in CategoryPLPView) sees the mark and
 * brings the results bar («N προϊόντα», Φίλτρα, Ταξινόμηση) to the top of the
 * screen. A one-shot mark rather than a #hash, so the URL stays clean and a
 * plain visit or a shared link still opens at the top as usual.
 */
export const PRODUCTS_ANCHOR_ID = "proionta";

const KEY = "mh:scroll-to-products";

export function markScrollToProducts(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // Storage blocked (private mode etc.): the page just opens at the top.
  }
}

/** True once per mark — reading it clears it. */
export function takeScrollToProductsMark(): boolean {
  try {
    if (sessionStorage.getItem(KEY) !== "1") return false;
    sessionStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
