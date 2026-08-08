import Link from "next/link";
import { Breadcrumbs, type Crumb } from "@/components/category/Breadcrumbs";
import { SortControl } from "@/components/category/SortControl";
import { Pagination } from "@/components/category/Pagination";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";
import type { ProductSort } from "@/lib/data/products";

const PAGE_SIZE = 12;

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
  extraParams,
  emptyMessage,
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
  // Fixed params every page link must keep (e.g. the search query `q`) —
  // separate from `basePath` so pagination/sort links don't end up with a
  // malformed second "?" when basePath itself would otherwise carry a query.
  extraParams?: Record<string, string>;
  emptyMessage?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

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
          <SortControl current={sort} />
        </div>

        {products.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-muted">
            {emptyMessage ?? "Δεν βρέθηκαν προϊόντα σε αυτή την κατηγορία αυτή τη στιγμή."}
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          buildHref={(p) => {
            const params = new URLSearchParams(extraParams);
            if (sort !== "newest") params.set("sort", sort);
            if (p > 1) params.set("page", String(p));
            const qs = params.toString();
            return qs ? `${basePath}?${qs}` : basePath;
          }}
        />
      </div>
    </>
  );
}
