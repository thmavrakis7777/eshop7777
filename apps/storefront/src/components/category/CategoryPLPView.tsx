import Link from "next/link";
import { headers } from "next/headers";
import { Breadcrumbs, type Crumb } from "@/components/category/Breadcrumbs";
import { CategoryChildNav, type ChildCategoryLink } from "@/components/category/CategoryChildNav";
import { SortControl } from "@/components/category/SortControl";
import { CategoryFilterSidebar } from "@/components/category/CategoryFilterSidebar";
import { CategoryFilterDrawer } from "@/components/category/CategoryFilterDrawer";
import { renderBody } from "@/components/content/ContentPageView";
import { InfiniteProductGrid, type ProductSource } from "@/components/category/InfiniteProductGrid";
import type { Product } from "@/lib/types";
import type { CategoryFacets, CategoryFilters, ProductSort } from "@/lib/data/products";
import { safeJsonLd } from "@/lib/json-ld";
import { siteUrl } from "@/lib/site-config";

// Bumped from 12 to 24 alongside infinite scroll: fewer round-trips per
// scroll session, still small/fast for the first paint. One shared value
// for the SSR'd first page and every client-fetched batch after it, so a
// direct visit to ?page=2 always renders the exact same slice either way.
const PAGE_SIZE = 24;

export { PAGE_SIZE };

export async function CategoryPLPView({
  title,
  description,
  breadcrumbs,
  childCategories,
  childNavTitle,
  parentLink,
  longDescription,
  products,
  count,
  sort,
  page,
  basePath,
  source,
  extraParams,
  emptyMessage,
  sortable = true,
  facets,
  filters,
  collectionUrl,
}: {
  title: string;
  description?: string;
  breadcrumbs: Crumb[];
  /** Direct children of the category being viewed — never the whole subtree. */
  childCategories?: ChildCategoryLink[];
  childNavTitle?: string;
  /**
   * Where "up one level" goes. Offered again beside the empty state because
   * a shopper who lands on a category with nothing in it is looking at the
   * middle of the page, not at the breadcrumb they scrolled past.
   */
  parentLink?: Crumb;
  /**
   * Owner-written category copy, rendered *after* the grid rather than
   * between the H1 and the products. It runs to several paragraphs where
   * it exists at all, and putting that above the fold would push the child
   * picker and the products themselves off a phone screen — the shopper
   * came to shop, and the crawler reads the page either way.
   */
  longDescription?: string;
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
  // Category-only: which filters can be shown and which are currently
  // active. Undefined for listing types that don't offer filtering yet
  // (search, sale, featured, collections) — nothing filter-related renders.
  facets?: CategoryFacets;
  filters?: CategoryFilters;
  /**
   * Absolute URL of this listing, e.g. `${siteUrl}/kouzina/mageirika-skeyi`.
   * Only passed for real category/subcategory pages (CategoryRoute) — search
   * results, New Arrivals, Sale and Collections leave this undefined, so no
   * CollectionPage schema is emitted for listing types that aren't a
   * genuine, permanent taxonomy node. Renders `mainEntity.itemListElement`
   * from whatever `products` this page actually shows (real handles/titles,
   * correctly offset for pagination) — never invented, never a fake
   * Product schema.
   */
  collectionUrl?: string;
}) {
  const nonce = collectionUrl ? ((await headers()).get("x-nonce") ?? undefined) : undefined;
  const collectionJsonLd = collectionUrl
    ? {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        url: collectionUrl,
        ...(description ? { description } : {}),
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: count,
          itemListElement: products.map((p, i) => ({
            "@type": "ListItem",
            position: (page - 1) * PAGE_SIZE + i + 1,
            url: `${siteUrl}/proionta/${p.handle}`,
            name: p.title,
          })),
        },
      }
    : null;

  return (
    <>
      {collectionJsonLd && (
        <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionJsonLd) }} />
      )}
      <Breadcrumbs items={breadcrumbs} />

      <div className="container-shell mt-4">
        <h1 className="text-3xl text-ink md:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm text-ink-muted md:text-base">{description}</p>}

        {childCategories && childCategories.length > 0 && (
          <CategoryChildNav title={childNavTitle ?? "Διάλεξε κατηγορία"} items={childCategories} />
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <span className="text-sm text-ink-muted">{count} προϊόντα</span>
          <div className="flex items-center gap-3">
            {facets && filters && <CategoryFilterDrawer facets={facets} filters={filters} />}
            {sortable && <SortControl current={sort} />}
          </div>
        </div>

        <div className="mt-6 flex items-start gap-8">
          {facets && filters && <CategoryFilterSidebar facets={facets} filters={filters} />}

          <div className="min-w-0 flex-1">
            {products.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-ink-muted">
                  {emptyMessage ?? "Δεν βρέθηκαν προϊόντα σε αυτή την κατηγορία αυτή τη στιγμή."}
                </p>
                {parentLink && (
                  <Link
                    href={parentLink.href}
                    className="mt-4 inline-block py-1.5 text-sm font-medium text-accent hover:underline"
                  >
                    <span aria-hidden="true">←</span> Επιστροφή σε {parentLink.label}
                  </Link>
                )}
              </div>
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
                filters={filters}
              />
            )}
          </div>
        </div>

        {longDescription && (
          <section className="mt-14 max-w-3xl border-t border-border pt-8">
            <div className="flex flex-col gap-4 text-sm leading-relaxed md:text-base">
              {renderBody(longDescription)}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
