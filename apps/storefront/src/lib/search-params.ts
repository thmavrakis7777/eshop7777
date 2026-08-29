import type { CategoryFacets, CategoryFilters, ProductSort } from "@/lib/data/products";

const VALID_SORTS: ProductSort[] = ["newest", "title-asc", "price-asc", "price-desc"];

// The full set of URL param keys a category filter can occupy — used both to
// detect "is any filter active" (for the noindex decision) and to parse them.
const FILTER_PARAM_KEYS = ["price_min", "price_max", "in_stock", "material", "origin", "sale"] as const;

type RawSearchParams = Record<string, string | string[] | undefined>;

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function firstOf(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function hasAnyFilterParam(searchParams: RawSearchParams): boolean {
  return FILTER_PARAM_KEYS.some((k) => searchParams[k] !== undefined);
}

// Every value is validated against that category's own facets — a param
// naming a material/origin this category doesn't actually have is dropped
// silently, the same trust boundary orderBy()/parseSort() already apply to
// `sort`. Keeps a mistyped or stale URL from ever reaching SQL as "valid."
export function parseFilters(searchParams: RawSearchParams, facets: CategoryFacets): CategoryFilters {
  const filters: CategoryFilters = {};

  const minEuros = Number(firstOf(searchParams.price_min));
  const maxEuros = Number(firstOf(searchParams.price_max));
  let minCents = Number.isFinite(minEuros) && minEuros >= 0 ? Math.round(minEuros * 100) : undefined;
  let maxCents = Number.isFinite(maxEuros) && maxEuros >= 0 ? Math.round(maxEuros * 100) : undefined;
  if (minCents != null && maxCents != null && minCents > maxCents) {
    [minCents, maxCents] = [maxCents, minCents];
  }
  if (minCents != null) filters.minPriceCents = minCents;
  if (maxCents != null) filters.maxPriceCents = maxCents;

  if (facets.hasOutOfStock) {
    const raw = firstOf(searchParams.in_stock);
    if (raw === "1" || raw === "true") filters.inStockOnly = true;
  }

  const materials = toArray(searchParams.material).filter((m) => facets.materials.includes(m));
  if (materials.length > 0) filters.material = materials;

  const originCodes = new Set(facets.origins.map((o) => o.code));
  const origins = toArray(searchParams.origin).filter((o) => originCodes.has(o));
  if (origins.length > 0) filters.origin = origins;

  // Not facet-gated like material/origin — "on sale" isn't a value drawn
  // from this category's product data, it's a fixed predicate (see
  // SALE_PREDICATE) that's always a valid thing to ask for.
  if (firstOf(searchParams.sale) === "1") filters.saleOnly = true;

  return filters;
}

export function countActiveFilters(filters: CategoryFilters): number {
  let n = 0;
  if (filters.minPriceCents != null || filters.maxPriceCents != null) n++;
  if (filters.inStockOnly) n++;
  if (filters.material && filters.material.length > 0) n++;
  if (filters.origin && filters.origin.length > 0) n++;
  if (filters.saleOnly) n++;
  return n;
}

// The reverse of parseFilters — used to carry the active filters into
// crawlable hrefs (the <noscript> pagination fallback) alongside `sort`.
export function filtersToSearchEntries(filters: CategoryFilters): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  if (filters.minPriceCents != null) entries.push(["price_min", String(filters.minPriceCents / 100)]);
  if (filters.maxPriceCents != null) entries.push(["price_max", String(filters.maxPriceCents / 100)]);
  if (filters.inStockOnly) entries.push(["in_stock", "1"]);
  for (const m of filters.material ?? []) entries.push(["material", m]);
  for (const o of filters.origin ?? []) entries.push(["origin", o]);
  if (filters.saleOnly) entries.push(["sale", "1"]);
  return entries;
}

export function parseSort(value: string | string[] | undefined): ProductSort {
  const raw = Array.isArray(value) ? value[0] : value;
  return (VALID_SORTS as string[]).includes(raw ?? "") ? (raw as ProductSort) : "newest";
}

export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

// A paginated listing must self-canonicalise: pointing page 2+ at page 1
// tells Google the deeper pages are duplicates, and any product that only
// appears past page 1 loses its internal link equity. `sort` is deliberately
// *not* carried through — the sort variants are genuine duplicates of each
// other, so they all canonicalise to the unsorted page.
export function canonicalListingPath(basePath: string, page: number): string {
  return page > 1 ? `${basePath}?page=${page}` : basePath;
}
