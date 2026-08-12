import Link from "next/link";
import { Breadcrumbs, type Crumb } from "@/components/category/Breadcrumbs";
import { SortControl } from "@/components/category/SortControl";
import { InfiniteProductGrid, type ProductSource } from "@/components/category/InfiniteProductGrid";
import type { Product } from "@/lib/types";
import type { ProductSort } from "@/lib/data/products";

// Bumped from 12 to 24 alongside infinite scroll: fewer round-trips per
// scroll session, still small/fast for the first paint. One shared value
// for the SSR'd first page and every client-fetched batch after it, so a
// direct visit to ?page=2 always renders the exact same slice either way.
const PAGE_SIZE = 24;

export { PAGE_SIZE };

export function CategoryPLPView({
  title,
  description,
  breadcrumbs,
  subcategories,
  products,
  count,
  sort,
  page,
  basePath,
  source,
  extraParams,
  emptyMessage,
  sortable = true,
}: {
  title: string;
  description?: string;
  breadcrumbs: Crumb[];
  subcategories?: Crumb[];
  products: Product[];
  count: number;
  sort: ProductSort;
  page: number;
  // Pure path, no query string — e.g. "/kouzina", not "/kouzina?sort=...".
  basePath: string;
  // Which data adapter the infinite-scroll grid should call for subsequent
  // batches (category/subcategory, New Arrivals, or search) — see
  // lib/actions/products.ts.
  source: ProductSource;
  // Fixed params every page link must keep (e.g. the search query `q`) —
  // separate from `basePath` so pagination/sort links don't end up with a
  // malformed second "?" when basePath itself would otherwise carry a query.
  extraParams?: Record<string, string>;
  emptyMessage?: string;
  // Search results are relevance-ranked by lib/search.ts, and
  // searchProducts() takes no sort at all — rendering the sort control
  // there produced a dropdown that rewrote the URL, changed nothing, and
  // visibly snapped back to "Νεότερα πρώτα" (confirmed live). Listings
  // that really are sortable leave this at its default.
  sortable?: boolean;
}) {
  return (
    <>
      <Breadcrumbs items={breadcrumbs} />

      <div className="container-shell mt-4">
        <h1 className="text-3xl text-ink md:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm text-ink-muted md:text-base">{description}</p>}

        {subcategories && subcategories.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {subcategories.map((sub) => (
              <Link
                key={sub.href}
                href={sub.href}
                className="rounded-full border border-border px-4 py-2 text-sm text-ink hover:border-accent hover:text-accent transition-colors"
              >
                {sub.label}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <span className="text-sm text-ink-muted">{count} προϊόντα</span>
          {sortable && <SortControl current={sort} />}
        </div>

        {products.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-muted">
            {emptyMessage ?? "Δεν βρέθηκαν προϊόντα σε αυτή την κατηγορία αυτή τη στιγμή."}
          </p>
        ) : (
          <InfiniteProductGrid
            source={source}
            sort={sort}
            page={page}
            pageSize={PAGE_SIZE}
            initialProducts={products}
            initialCount={count}
            basePath={basePath}
            extraParams={extraParams}
          />
        )}
      </div>
    </>
  );
}
