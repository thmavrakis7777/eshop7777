import type { ProductSort } from "@/lib/data/products";

const VALID_SORTS: ProductSort[] = ["newest", "title-asc", "price-asc", "price-desc"];

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
