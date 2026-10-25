"use client";

import { usePathname, useRouter } from "next/navigation";
import { currentQuery } from "@/lib/current-query";
import { CategoryFilterFields, filtersToDraft, hasAnyFacet, type FilterDraft } from "@/components/category/CategoryFilterFields";
import { countActiveFilters } from "@/lib/search-params";
import { clearedFilterUrl, filterDraftUrl, type CategoryFilterOptions } from "@/lib/category-filter";
import { markScrollToProducts } from "@/lib/scroll-to-products";
import type { CategoryFacets, CategoryFilters } from "@/lib/data/products";

// Persistent desktop panel — every change writes straight to the URL (no
// separate "apply" step, there's room here and instant feedback reads as
// more premium). Renders nothing at all when this category has no real
// facet to offer, rather than an empty box.
export function CategoryFilterSidebar({
  facets,
  filters,
  categoryFilter,
}: {
  facets: CategoryFacets;
  filters: CategoryFilters;
  categoryFilter?: CategoryFilterOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (!hasAnyFacet(facets, categoryFilter)) return null;

  const draft = filtersToDraft(filters, categoryFilter);
  const activeCount = countActiveFilters(filters);

  // The result opens where the products start, not at the top of the page
  // (ScrollToProducts in CategoryPLPView does the scrolling).
  function go(url: string) {
    markScrollToProducts();
    router.push(url, { scroll: false });
  }

  function handleChange(next: FilterDraft) {
    go(filterDraftUrl(pathname, currentQuery(), next, categoryFilter));
  }

  function clearAll() {
    go(clearedFilterUrl(pathname, currentQuery()));
  }

  return (
    <aside className="hidden w-64 shrink-0 lg:block" aria-label="Φίλτρα προϊόντων">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Φίλτρα{activeCount > 0 && ` (${activeCount})`}</h2>
        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className="text-xs text-ink-muted hover:text-ink hover:underline">
            Καθαρισμός
          </button>
        )}
      </div>
      <div className="mt-4">
        <CategoryFilterFields facets={facets} draft={draft} onChange={handleChange} categoryFilter={categoryFilter} />
      </div>
    </aside>
  );
}
