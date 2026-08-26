"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CategoryFilterFields, filtersToDraft, hasAnyFacet, type FilterDraft } from "@/components/category/CategoryFilterFields";
import { countActiveFilters } from "@/lib/search-params";
import type { CategoryFacets, CategoryFilters } from "@/lib/data/products";

const FILTER_KEYS = ["price_min", "price_max", "in_stock", "material", "origin"];

function draftToParams(base: URLSearchParams, draft: FilterDraft): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const k of FILTER_KEYS) params.delete(k);
  if (draft.priceMin) params.set("price_min", draft.priceMin);
  if (draft.priceMax) params.set("price_max", draft.priceMax);
  if (draft.inStock) params.set("in_stock", "1");
  for (const m of draft.material) params.append("material", m);
  for (const o of draft.origin) params.append("origin", o);
  params.delete("page");
  return params;
}

// Persistent desktop panel — every change writes straight to the URL (no
// separate "apply" step, there's room here and instant feedback reads as
// more premium). Renders nothing at all when this category has no real
// facet to offer, rather than an empty box.
export function CategoryFilterSidebar({ facets, filters }: { facets: CategoryFacets; filters: CategoryFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!hasAnyFacet(facets)) return null;

  const draft = filtersToDraft(filters);
  const activeCount = countActiveFilters(filters);

  function handleChange(next: FilterDraft) {
    const params = draftToParams(searchParams, next);
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams);
    for (const k of FILTER_KEYS) params.delete(k);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
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
        <CategoryFilterFields facets={facets} draft={draft} onChange={handleChange} />
      </div>
    </aside>
  );
}
