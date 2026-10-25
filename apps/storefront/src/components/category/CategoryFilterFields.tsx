"use client";

import { useState } from "react";
import Link from "@/components/ui/Link";
import type { CategoryFacets, CategoryFilters } from "@/lib/data/products";
import { EMPTY_DRAFT, type CategoryFilterOptions, type FilterDraft } from "@/lib/category-filter";

export { EMPTY_DRAFT, type FilterDraft };

/** The form's starting state: the active filters, plus the ticked categories. */
export function filtersToDraft(f: CategoryFilters, categoryFilter?: CategoryFilterOptions): FilterDraft {
  return {
    priceMin: f.minPriceCents != null ? String(f.minPriceCents / 100) : "",
    priceMax: f.maxPriceCents != null ? String(f.maxPriceCents / 100) : "",
    inStock: !!f.inStockOnly,
    material: f.material ?? [],
    origin: f.origin ?? [],
    categories: categoryFilter?.selected ?? [],
  };
}

export function isDraftEmpty(d: FilterDraft): boolean {
  return (
    !d.priceMin && !d.priceMax && !d.inStock && d.material.length === 0 && d.origin.length === 0 && d.categories.length === 0
  );
}

export function countDraft(d: FilterDraft): number {
  let n = 0;
  if (d.priceMin || d.priceMax) n++;
  if (d.inStock) n++;
  if (d.material.length > 0) n++;
  if (d.origin.length > 0) n++;
  if (d.categories.length > 0) n++;
  return n;
}

const checkbox = "h-4 w-4 shrink-0 rounded-sm border-border text-accent focus-visible:outline-accent";
const label = "flex items-center gap-2 py-1 text-sm text-ink";

/**
 * The filter form itself — category, price range, availability, material,
 * origin — shared by the desktop sidebar (commits every change straight to
 * the URL) and the mobile drawer (stages changes locally, commits on
 * "Εφαρμογή φίλτρων"). Every list is tick boxes, so a shopper can pick as
 * many values and groups as they like (lib/category-filter.ts). Sections
 * only render when that facet actually has real, narrowing data — see
 * CategoryFacets.
 */
export function CategoryFilterFields({
  facets,
  draft,
  onChange,
  categoryFilter,
  onNavigate,
}: {
  facets: CategoryFacets;
  draft: FilterDraft;
  onChange: (next: FilterDraft) => void;
  /** «Κατηγορία» — built by CategoryRoute, see CategoryFilterOptions. */
  categoryFilter?: CategoryFilterOptions;
  /** Lets the mobile sheet close itself when «← parent» is followed. */
  onNavigate?: () => void;
}) {
  const hasPrice = facets.priceMinCents != null && facets.priceMaxCents != null;

  // Price inputs stay locally controlled while typing; committed to the
  // parent (which may push a URL change immediately) only on blur/Enter, so
  // desktop's auto-apply doesn't fire a navigation per keystroke. Re-synced
  // from `draft` during render (not an effect — same pattern used by
  // InfiniteProductGrid's resetKey) whenever it changes out from under us,
  // e.g. a "Καθαρισμός" click.
  const [price, setPrice] = useState(() => ({ min: draft.priceMin, max: draft.priceMax }));
  const [syncedFrom, setSyncedFrom] = useState({ min: draft.priceMin, max: draft.priceMax });
  if (syncedFrom.min !== draft.priceMin || syncedFrom.max !== draft.priceMax) {
    setSyncedFrom({ min: draft.priceMin, max: draft.priceMax });
    setPrice({ min: draft.priceMin, max: draft.priceMax });
  }

  function commitPrice() {
    if (price.min === draft.priceMin && price.max === draft.priceMax) return;
    onChange({ ...draft, priceMin: price.min, priceMax: price.max });
  }

  function toggleMaterial(m: string, checked: boolean) {
    const next = checked ? [...draft.material, m] : draft.material.filter((x) => x !== m);
    onChange({ ...draft, material: next });
  }

  function toggleCategory(slug: string, checked: boolean) {
    const next = checked ? [...draft.categories, slug] : draft.categories.filter((x) => x !== slug);
    onChange({ ...draft, categories: next });
  }

  function toggleOrigin(code: string, checked: boolean) {
    const next = checked ? [...draft.origin, code] : draft.origin.filter((x) => x !== code);
    onChange({ ...draft, origin: next });
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {categoryFilter && categoryFilter.options.length > 0 && (
        <section className="py-5 first:pt-0">
          <h3 className="text-sm font-medium text-ink">Κατηγορία</h3>
          {categoryFilter.up && (
            <Link
              href={categoryFilter.up.href}
              onClick={onNavigate}
              className="mt-2 inline-flex items-center gap-1 py-1 text-sm text-ink-muted hover:text-accent"
            >
              <span aria-hidden="true">←</span> {categoryFilter.up.name}
            </Link>
          )}
          <div className="mt-2 max-h-64 overflow-y-auto">
            {categoryFilter.options.map((o) => (
              <label key={o.slug} className={`${label} justify-between`}>
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className={checkbox}
                    checked={draft.categories.includes(o.slug)}
                    onChange={(e) => toggleCategory(o.slug, e.target.checked)}
                  />
                  {o.name}
                </span>
                <span className="text-xs text-ink-muted tabular-nums">{o.count}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      {hasPrice && (
        <section className="py-5 first:pt-0">
          <h3 className="text-sm font-medium text-ink">Τιμή</h3>
          <div className="mt-3 flex items-center gap-2">
            <label className="flex-1">
              <span className="sr-only">Ελάχιστη τιμή</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder={String(Math.floor(facets.priceMinCents! / 100))}
                value={price.min}
                onChange={(e) => setPrice({ ...price, min: e.target.value })}
                onBlur={commitPrice}
                onKeyDown={(e) => e.key === "Enter" && commitPrice()}
                className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent"
              />
            </label>
            <span className="text-ink-muted" aria-hidden="true">–</span>
            <label className="flex-1">
              <span className="sr-only">Μέγιστη τιμή</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder={String(Math.ceil(facets.priceMaxCents! / 100))}
                value={price.max}
                onChange={(e) => setPrice({ ...price, max: e.target.value })}
                onBlur={commitPrice}
                onKeyDown={(e) => e.key === "Enter" && commitPrice()}
                className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent"
              />
            </label>
            <span className="text-sm text-ink-muted">€</span>
          </div>
        </section>
      )}

      {facets.hasOutOfStock && (
        <section className="py-5 first:pt-0">
          <label className={label}>
            <input
              type="checkbox"
              className={checkbox}
              checked={draft.inStock}
              onChange={(e) => onChange({ ...draft, inStock: e.target.checked })}
            />
            Διαθέσιμα
          </label>
        </section>
      )}

      {facets.materials.length > 0 && (
        <section className="py-5 first:pt-0">
          <h3 className="text-sm font-medium text-ink">Υλικό</h3>
          <div className="mt-2 max-h-48 overflow-y-auto">
            {facets.materials.map((m) => (
              <label key={m} className={label}>
                <input
                  type="checkbox"
                  className={checkbox}
                  checked={draft.material.includes(m)}
                  onChange={(e) => toggleMaterial(m, e.target.checked)}
                />
                {m}
              </label>
            ))}
          </div>
        </section>
      )}

      {facets.origins.length > 0 && (
        <section className="py-5 first:pt-0">
          <h3 className="text-sm font-medium text-ink">Προέλευση</h3>
          <div className="mt-2 max-h-48 overflow-y-auto">
            {facets.origins.map((o) => (
              <label key={o.code} className={label}>
                <input
                  type="checkbox"
                  className={checkbox}
                  checked={draft.origin.includes(o.code)}
                  onChange={(e) => toggleOrigin(o.code, e.target.checked)}
                />
                {o.label}
              </label>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function hasAnyFacet(facets: CategoryFacets, categoryFilter?: CategoryFilterOptions): boolean {
  return (
    (categoryFilter?.options.length ?? 0) > 0 ||
    (facets.priceMinCents != null && facets.priceMaxCents != null) ||
    facets.hasOutOfStock ||
    facets.materials.length > 0 ||
    facets.origins.length > 0
  );
}
