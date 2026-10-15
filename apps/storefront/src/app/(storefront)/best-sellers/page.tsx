import type { Metadata } from "next";
import { CategoryPLPView, PAGE_SIZE } from "@/components/category/CategoryPLPView";
import { getBestSellerProductsPaged } from "@/lib/data/products";
import { canonicalListingPath, parsePage, parseSort } from "@/lib/search-params";
import { siteUrl } from "@/lib/site-config";

type Props = {
  searchParams: Promise<{ sort?: string; page?: string }>;
};

const TITLE = "Best sellers";
const DESCRIPTION = "Τα αγαπημένα προϊόντα για το σπίτι σου.";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page: pageParam } = await searchParams;
  const path = canonicalListingPath("/best-sellers", parsePage(pageParam));

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: path },
    openGraph: { title: TITLE, description: DESCRIPTION, url: `${siteUrl}${path}` },
  };
}

export default async function BestSellersPage({ searchParams }: Props) {
  const { sort: sortParam, page: pageParam } = await searchParams;
  // Unlike category/New Arrivals pages, an unsorted visit here defaults to
  // alphabetical order (not "newest") — this is the owner's hand-picked
  // list (the product editor's «Best sellers» checkbox), not a recency feed,
  // so it shouldn't default to looking like a duplicate of /nea-afiksi.
  // Still fully re-sortable via the same control.
  const sort = sortParam ? parseSort(sortParam) : "title-asc";
  const page = parsePage(pageParam);

  const { products, count } = await getBestSellerProductsPaged({
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <CategoryPLPView
      title={TITLE}
      description={DESCRIPTION}
      breadcrumbs={[{ label: TITLE, href: "/best-sellers" }]}
      products={products}
      count={count}
      sort={sort}
      page={page}
      basePath="/best-sellers"
      source={{ type: "best-sellers" }}
      emptyMessage="Δεν υπάρχουν best sellers αυτή τη στιγμή."
    />
  );
}
