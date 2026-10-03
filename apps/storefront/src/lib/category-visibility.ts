import type { CategoryNode } from "@/lib/types";

/**
 * A product category with nothing to list — no active product in it or in
 * any category below it (`productCount` is the subtree count, the same set
 * its listing page renders; see fetchAllCategories in lib/data/categories.ts).
 *
 * Such a page is kept out of search results — `noindex, follow` in its
 * metadata (lib/category-route.ts) and left out of sitemap.xml — because an
 * indexable page that only says «Δεν βρέθηκαν προϊόντα» is what Google
 * treats as a soft 404 / thin page, and most of the catalog is in that state
 * until the real products are loaded. Nothing has to be undone by hand: the
 * first active product added anywhere under the category lifts both. Visitors
 * still see and reach the page normally — this only concerns search engines.
 *
 * Service pages ('landing', e.g. the key-copying page) never list products by
 * design, so they never count as empty.
 */
export function isEmptyListing(category: Pick<CategoryNode, "pageType" | "productCount">): boolean {
  return category.pageType === "products" && category.productCount === 0;
}

/**
 * The category description as one plain-text line, for the CollectionPage
 * JSON-LD. It is the same text the page shows under the products
 * (renderBody), so the structured data describes what is visibly there —
 * only the owner's line and paragraph breaks are folded into spaces.
 */
export function descriptionPlainText(description: string | null | undefined): string | undefined {
  const text = description?.replace(/\s+/g, " ").trim();
  return text || undefined;
}
