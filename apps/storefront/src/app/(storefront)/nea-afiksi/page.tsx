import type { Metadata } from "next";
import { CategoryPLPView, PAGE_SIZE } from "@/components/category/CategoryPLPView";
import { getNewArrivalsPaged } from "@/lib/data/products";
import { canonicalListingPath, parsePage, parseSort } from "@/lib/search-params";
import { siteUrl } from "@/lib/site-config";

type Props = {
  searchParams: Promise<{ sort?: string; page?: string }>;
};

const TITLE = "Νέες αφίξεις";
const DESCRIPTION =
  "Τα πιο πρόσφατα προϊόντα μας για το σπίτι — ανακάλυψε τις νέες αφίξεις πρώτος/η.";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page: pageParam } = await searchParams;
  const path = canonicalListingPath("/nea-afiksi", parsePage(pageParam));

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: path },
    openGraph: { title: TITLE, description: DESCRIPTION, url: `${siteUrl}${path}` },
  };
}

export default async function NewArrivalsPage({ searchParams }: Props) {
  const { sort: sortParam, page: pageParam } = await searchParams;
  const sort = parseSort(sortParam);
  const page = parsePage(pageParam);

  const { products, count } = await getNewArrivalsPaged({
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <CategoryPLPView
      title={TITLE}
      description={DESCRIPTION}
      breadcrumbs={[{ label: TITLE, href: "/nea-afiksi" }]}
      products={products}
      count={count}
      sort={sort}
      page={page}
      basePath="/nea-afiksi"
      source={{ type: "new-arrivals" }}
      emptyMessage="Δεν υπάρχουν νέες αφίξεις αυτή τη στιγμή — έλα σύντομα ξανά."
    />
  );
}
