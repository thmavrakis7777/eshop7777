"use client";

import { useRouter, usePathname } from "next/navigation";
import { currentQuery } from "@/lib/current-query";
import { categoryListingUrl, categoryPathOf } from "@/lib/filtered-url";
import { markScrollToProducts } from "@/lib/scroll-to-products";
import type { ProductSort } from "@/lib/data/products";

const OPTIONS: Array<{ value: ProductSort; label: string }> = [
  { value: "newest", label: "Νεότερα πρώτα" },
  { value: "title-asc", label: "Αλφαβητικά (Α-Ω)" },
  { value: "price-asc", label: "Τιμή: Χαμηλή προς Υψηλή" },
  { value: "price-desc", label: "Τιμή: Υψηλή προς Χαμηλή" },
];

// `defaultLabel` renames the "newest" option where the listing's default
// isn't purely newest-first (category pages: the owner's manual order first).
// The URL value stays "newest" so existing ?sort=newest links keep working.
export function SortControl({
  current,
  defaultLabel,
  categoryListing = false,
}: {
  current: ProductSort;
  defaultLabel?: string;
  /**
   * A category page: the sorted view goes to /filtra/… (lib/filtered-url.ts),
   * or the client router would keep showing the cached, unsorted page.
   */
  categoryListing?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(value: string) {
    const params = currentQuery();
    params.set("sort", value);
    params.delete("page");
    // Stay at the products, like a filter change (lib/scroll-to-products.ts).
    markScrollToProducts();
    router.push(
      categoryListing ? categoryListingUrl(categoryPathOf(pathname), params) : `${pathname}?${params.toString()}`,
      { scroll: false }
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm text-ink-muted">
      {/* Visually hidden on phones, not display:none, so the select keeps
          its accessible name there too (Lighthouse select-name). */}
      <span className="sr-only sm:not-sr-only">Ταξινόμηση:</span>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value === "newest" && defaultLabel ? defaultLabel : o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
