import type { CategoryFacets, CategoryFilters, ProductSort } from "@/lib/data/products";
import { filtersToSearchEntries } from "@/lib/search-params";

export type ActiveFilterChip = {
  /** What the shopper sees, e.g. «Υλικό: Εμαγιέ». */
  label: string;
  /** The same listing with only this filter removed (page 1, same sort). */
  href: string;
};

/**
 * The «Προσφορές ✕ / Υλικό: Εμαγιέ ✕» row above a filtered category's
 * products: one chip per active value, each a plain link to the listing
 * without it. Plain links, not client state — removing a filter is the same
 * URL change the sidebar makes, so it works without JavaScript too.
 *
 * `clearHref` drops every filter at once (back to the cached category URL
 * when no sort is set). Offered only when more than one chip is showing.
 */
export function activeFilterChips(
  filters: CategoryFilters,
  facets: CategoryFacets,
  basePath: string,
  sort: ProductSort
): { chips: ActiveFilterChip[]; clearHref: string | null } {
  const hrefWithout = (next: CategoryFilters) => listingHref(basePath, sort, next);
  const chips: ActiveFilterChip[] = [];

  if (filters.saleOnly) {
    chips.push({ label: "Προσφορές", href: hrefWithout({ ...filters, saleOnly: undefined }) });
  }
  if (filters.minPriceCents != null || filters.maxPriceCents != null) {
    const min = filters.minPriceCents != null ? euros(filters.minPriceCents) : null;
    const max = filters.maxPriceCents != null ? euros(filters.maxPriceCents) : null;
    const range = min && max ? `${min}–${max} €` : min ? `από ${min} €` : `έως ${max} €`;
    chips.push({
      label: `Τιμή: ${range}`,
      href: hrefWithout({ ...filters, minPriceCents: undefined, maxPriceCents: undefined }),
    });
  }
  if (filters.inStockOnly) {
    chips.push({ label: "Διαθέσιμα", href: hrefWithout({ ...filters, inStockOnly: undefined }) });
  }
  for (const m of filters.material ?? []) {
    chips.push({
      label: `Υλικό: ${m}`,
      href: hrefWithout({ ...filters, material: filters.material!.filter((x) => x !== m) }),
    });
  }
  for (const code of filters.origin ?? []) {
    const label = facets.origins.find((o) => o.code === code)?.label ?? code;
    chips.push({
      label: `Προέλευση: ${label}`,
      href: hrefWithout({ ...filters, origin: filters.origin!.filter((x) => x !== code) }),
    });
  }

  return { chips, clearHref: chips.length > 1 ? listingHref(basePath, sort, {}) : null };
}

/** A child category's link that keeps the «Προσφορές» filter, if it is on. */
export function keepSaleFilter(href: string, filters: CategoryFilters): string {
  return filters.saleOnly ? `${href}?sale=1` : href;
}

function listingHref(basePath: string, sort: ProductSort, filters: CategoryFilters): string {
  const params = new URLSearchParams(filtersToSearchEntries(filters));
  // "newest" is what parseSort returns when no sort is set, so it is never
  // written back — that keeps an unfiltered result on the cached plain URL.
  if (sort !== "newest") params.set("sort", sort);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function euros(cents: number): string {
  return (cents / 100).toLocaleString("el-GR", { maximumFractionDigits: 2 });
}
