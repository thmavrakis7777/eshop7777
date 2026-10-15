"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
export function SortControl({ current, defaultLabel }: { current: ProductSort; defaultLabel?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-ink-muted">
      <span className="hidden sm:inline">Ταξινόμηση:</span>
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
