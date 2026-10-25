import { categoryListingUrl, categoryPathOf } from "@/lib/filtered-url";

/**
 * The category filter form's state and the URL it commits to — pure, shared
 * by the desktop sidebar (commits every change) and the mobile sheet
 * (commits on «Εφαρμογή φίλτρων»). Every group is multi-choice: ticks within
 * a group are OR (Ανοξείδωτο or Πλαστικό), groups are AND (and on offer, and
 * under 30 €), and the result is whatever combination the shopper ticks.
 */

// A form-friendly draft of CategoryFilters — price is text while the shopper
// is typing it, everything else mirrors the real filter shape directly.
export type FilterDraft = {
  priceMin: string;
  priceMax: string;
  inStock: boolean;
  material: string[];
  origin: string[];
  /** Ticked «Κατηγορία» slugs. */
  categories: string[];
};

export const EMPTY_DRAFT: FilterDraft = {
  priceMin: "",
  priceMax: "",
  inStock: false,
  material: [],
  origin: [],
  categories: [],
};

/**
 * «Κατηγορία» as tick boxes. Built on the server (CategoryRoute) because it
 * depends on where the page sits in the tree:
 *
 * - "children": a category with subcategories ticks them on its own page
 *   (/ygraerio?cat=kamineta-ygraeriou&cat=antallaktika-ygraeriou).
 * - "siblings": a subcategory lists its parent's subcategories with itself
 *   ticked. Ticking a second one moves to the parent with both ticked;
 *   unticking back to just this one returns here, to its own page.
 */
export type CategoryFilterOptions = {
  mode: "children" | "siblings";
  options: { slug: string; name: string; count: number }[];
  /** Ticked now: ?cat= in children mode, this page's own slug in siblings mode. */
  selected: string[];
  /** Siblings mode: this page's slug and its parent's path. */
  currentSlug?: string;
  parentPath?: string;
  /** Siblings mode: «← parent» above the list, filters kept. */
  up?: { name: string; href: string };
};

// Every key the form owns. Not "sale": the offers filter comes from the
// menu's «Προσφορές» link and stays on through every change made here.
const FORM_KEYS = ["price_min", "price_max", "in_stock", "material", "origin", "cat"];

/** The listing URL for this draft, starting from the current path and query. */
export function filterDraftUrl(
  pathname: string,
  current: URLSearchParams,
  draft: FilterDraft,
  categoryFilter?: CategoryFilterOptions
): string {
  const params = new URLSearchParams(current);
  for (const k of FORM_KEYS) params.delete(k);
  params.delete("page");
  if (draft.priceMin) params.set("price_min", draft.priceMin);
  if (draft.priceMax) params.set("price_max", draft.priceMax);
  if (draft.inStock) params.set("in_stock", "1");
  for (const m of draft.material) params.append("material", m);
  for (const o of draft.origin) params.append("origin", o);

  let path = categoryPathOf(pathname);
  if (categoryFilter?.mode === "siblings" && categoryFilter.parentPath) {
    const onlyThisPage = draft.categories.length === 1 && draft.categories[0] === categoryFilter.currentSlug;
    if (!onlyThisPage) {
      path = categoryFilter.parentPath;
      for (const c of draft.categories) params.append("cat", c);
    }
  } else {
    for (const c of draft.categories) params.append("cat", c);
  }

  return categoryListingUrl(path, params);
}

/**
 * «Καθαρισμός»: every form filter off, staying on this page. In siblings
 * mode that keeps this subcategory — its own page is its category choice.
 */
export function clearedFilterUrl(pathname: string, current: URLSearchParams): string {
  const params = new URLSearchParams(current);
  for (const k of FORM_KEYS) params.delete(k);
  params.delete("page");
  return categoryListingUrl(categoryPathOf(pathname), params);
}
