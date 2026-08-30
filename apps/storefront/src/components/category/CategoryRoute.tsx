import { notFound } from "next/navigation";
import { CategoryLandingView } from "@/components/category/CategoryLandingView";
import { CategoryPLPView, PAGE_SIZE } from "@/components/category/CategoryPLPView";
import { toChildLinks } from "@/components/category/CategoryChildNav";
import type { Crumb } from "@/components/category/Breadcrumbs";
import { categoryPathHref, getCategoryPath } from "@/lib/data/categories";
import { getCategoryFilterFacets, getProductsByCategoryHandle } from "@/lib/data/products";
import { parseFilters, parsePage, parseSort } from "@/lib/search-params";
import { siteUrl } from "@/lib/site-config";

/**
 * Every category page, at every depth.
 *
 * /kouzina, /kouzina/mageirika-skeyi and /kouzina/mageirika-skeyi/tigania are
 * the same page with a different number of segments, so they are one
 * component rather than three route files that happen to look alike. The
 * three `page.tsx` files exist only because Next needs a file per segment
 * count; each is a four-line adapter onto this.
 *
 * The single most visible bug this fixes: before, only the top-level route
 * passed its children down, so a subcategory's own children were invisible
 * on the storefront no matter what the dashboard said.
 */
export async function CategoryRoute({
  segments,
  searchParams,
}: {
  segments: string[];
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const path = await getCategoryPath(segments);
  // Covers a slug that doesn't exist, one that's inactive, and one that
  // exists but not under the parent the URL claims — all of which must 404
  // rather than render a category at a second address.
  if (!path) notFound();
  const { category, ancestors } = path;

  if (category.pageType === "landing") {
    return <CategoryLandingView category={category} ancestors={ancestors} />;
  }

  const sp = await searchParams;
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.page);
  const facets = await getCategoryFilterFacets(category.handle);
  const filters = parseFilters(sp, facets);

  const basePath = categoryPathHref(ancestors, category);
  const { products, count } = await getProductsByCategoryHandle(category.handle, {
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    filters,
  });

  const trail = [...ancestors, category];
  const breadcrumbs: Crumb[] = trail.map((c, i) => ({
    label: c.name,
    href: categoryPathHref(trail.slice(0, i), c),
  }));

  const parent = ancestors.at(-1);
  const parentLink: Crumb = parent
    ? { label: parent.name, href: categoryPathHref(ancestors.slice(0, -1), parent) }
    : { label: "Αρχική", href: "/" };

  return (
    <CategoryPLPView
      title={category.name}
      // Only what the owner actually wrote, and below the grid. The previous
      // auto-generated "Ανακάλυψε τη συλλογή {name}…" subtitle said nothing,
      // read awkwardly against uninflected Greek category names, and
      // repeating it down a third level would have been thin duplicate copy
      // on every leaf. The real descriptions the owner has written (see the
      // ΚΛΕΙΔΙΑ & ΑΣΦΑΛΕΙΑ branch) were meanwhile not rendered at all.
      longDescription={category.description}
      breadcrumbs={breadcrumbs}
      // displayChildren, not children: shows any category cross-listed here
      // (shop.category_secondary_parent) alongside this category's real
      // primary children — each link already points at its own real
      // canonical URL (toChildLinks), never a path built under this page.
      childCategories={toChildLinks(category.displayChildren)}
      // "Shop by category" entering a main category; "choose a type" once
      // you are already inside one and picking a narrower kind of thing.
      childNavTitle={ancestors.length === 0 ? "Αγόρασε ανά κατηγορία" : "Διάλεξε τύπο"}
      parentLink={parentLink}
      products={products}
      count={count}
      sort={sort}
      page={page}
      basePath={basePath}
      source={{ type: "category", categoryHandle: category.handle }}
      facets={facets}
      filters={filters}
      collectionUrl={page === 1 ? `${siteUrl}${basePath}` : undefined}
    />
  );
}
