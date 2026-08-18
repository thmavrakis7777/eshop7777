import type { Metadata } from "next";
import { CategoryPLPView, PAGE_SIZE } from "@/components/category/CategoryPLPView";
import { getSaleProductsPaged } from "@/lib/data/products";
import { canonicalListingPath, parsePage, parseSort } from "@/lib/search-params";
import { siteUrl } from "@/lib/site-config";

type Props = {
  searchParams: Promise<{ sort?: string; page?: string }>;
};

const TITLE = "Προσφορές";
const DESCRIPTION =
  "Όλα τα προϊόντα που βρίσκονται αυτή τη στιγμή σε προσφορά — δες τις τρέχουσες εκπτώσεις μας.";

/**
 * The sale listing.
 *
 * Entirely derived: a product appears here because a variant's compare-at
 * price is above its selling price, so the page updates itself when a
 * discount is applied or removed and when a product is deactivated. There is
 * no "sale" flag, collection or category to keep in sync — deliberately, so
 * the page can never disagree with the prices customers actually see.
 *
 * Left indexable even when empty rather than conditionally noindexed: it is a
 * permanent, linked destination whose emptiness is temporary, and flipping
 * robots on stock levels teaches crawlers the URL is unreliable.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page: pageParam } = await searchParams;
  const path = canonicalListingPath("/prosfores", parsePage(pageParam));

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: path },
    openGraph: { title: TITLE, description: DESCRIPTION, url: `${siteUrl}${path}` },
  };
}

export default async function SalePage({ searchParams }: Props) {
  const { sort: sortParam, page: pageParam } = await searchParams;
  const sort = parseSort(sortParam);
  const page = parsePage(pageParam);

  const { products, count } = await getSaleProductsPaged({
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <CategoryPLPView
      title={TITLE}
      description={DESCRIPTION}
      breadcrumbs={[{ label: TITLE, href: "/prosfores" }]}
      products={products}
      count={count}
      sort={sort}
      page={page}
      basePath="/prosfores"
      source={{ type: "sale" }}
      emptyMessage="Δεν υπάρχουν προσφορές αυτή τη στιγμή — έλα σύντομα ξανά."
    />
  );
}
