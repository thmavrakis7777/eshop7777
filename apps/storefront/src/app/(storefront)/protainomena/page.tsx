import type { Metadata } from "next";
import { CategoryPLPView, PAGE_SIZE } from "@/components/category/CategoryPLPView";
import { getFeaturedProductsPaged } from "@/lib/data/products";
import { canonicalListingPath, parsePage, parseSort } from "@/lib/search-params";
import { siteUrl } from "@/lib/site-config";

type Props = {
  searchParams: Promise<{ sort?: string; page?: string }>;
};

const TITLE = "Προτεινόμενα";
const DESCRIPTION = "Μια επιλεγμένη συλλογή προϊόντων για το σπίτι σου.";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page: pageParam } = await searchParams;
  const path = canonicalListingPath("/protainomena", parsePage(pageParam));

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: path },
    openGraph: { title: TITLE, description: DESCRIPTION, url: `${siteUrl}${path}` },
  };
}

export default async function FeaturedProductsPage({ searchParams }: Props) {
  const { sort: sortParam, page: pageParam } = await searchParams;
  // Unlike category/New Arrivals pages, an unsorted visit here defaults to
  // the curated alphabetical order (not "newest") — this is a hand-picked
  // slice, not a recency feed, so it shouldn't default to looking like a
  // duplicate of /nea-afiksi. Still fully re-sortable via the same control.
  const sort = sortParam ? parseSort(sortParam) : "title-asc";
  const page = parsePage(pageParam);

  const { products, count } = await getFeaturedProductsPaged({
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <CategoryPLPView
      title={TITLE}
      description={DESCRIPTION}
      breadcrumbs={[{ label: TITLE, href: "/protainomena" }]}
      products={products}
      count={count}
      sort={sort}
      page={page}
      basePath="/protainomena"
      source={{ type: "featured" }}
      emptyMessage="Δεν υπάρχουν προτεινόμενα προϊόντα αυτή τη στιγμή."
    />
  );
}
