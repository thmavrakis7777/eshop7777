import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPLPView, PAGE_SIZE } from "@/components/category/CategoryPLPView";
import { getCollectionByHandle } from "@/lib/data/collections";
import { getProductsByCollectionHandle } from "@/lib/data/products";
import { canonicalListingPath, parsePage, parseSort } from "@/lib/search-params";
import { getSeoOverride } from "@/lib/data/seo";
import { siteUrl } from "@/lib/site-config";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const collection = await getCollectionByHandle(slug);
  if (!collection) return {};

  // Same admin-editable SEO override pattern as category pages — the
  // canonical override only applies to page 1, see CategoryPage for why.
  const seo = await getSeoOverride("collection", collection.id);
  const page = parsePage(pageParam);
  const title = seo?.seoTitle || collection.title;
  const description =
    seo?.metaDescription || collection.description || `${collection.title} — επιλεγμένα προϊόντα για το σπίτι σου.`;
  const path =
    page === 1 && seo?.canonicalUrl ? seo.canonicalUrl : canonicalListingPath(`/syllogi/${collection.slug}`, page);

  return {
    title: seo?.seoTitle ? { absolute: seo.seoTitle } : title,
    description,
    alternates: { canonical: path },
    ...(seo?.robots === "noindex" ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      url: `${siteUrl}${path}`,
      ...(seo?.socialImageUrl ? { images: [{ url: seo.socialImageUrl }] } : {}),
    },
    ...(seo?.keywords ? { keywords: seo.keywords } : {}),
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort: sortParam, page: pageParam } = await searchParams;

  const collection = await getCollectionByHandle(slug);
  if (!collection) notFound();

  const sort = parseSort(sortParam);
  const page = parsePage(pageParam);

  const { products, count } = await getProductsByCollectionHandle(slug, {
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <CategoryPLPView
      title={collection.title}
      description={collection.description ?? undefined}
      breadcrumbs={[{ label: collection.title, href: `/syllogi/${collection.slug}` }]}
      products={products}
      count={count}
      sort={sort}
      page={page}
      basePath={`/syllogi/${collection.slug}`}
      source={{ type: "collection", collectionHandle: slug }}
      emptyMessage="Δεν υπάρχουν προϊόντα σε αυτή τη συλλογή αυτή τη στιγμή."
    />
  );
}
