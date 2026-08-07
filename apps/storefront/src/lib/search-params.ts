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
