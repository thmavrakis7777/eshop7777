import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPLPView, PAGE_SIZE } from "@/components/category/CategoryPLPView";
import { getCategoryByHandle } from "@/lib/data/categories";
import { getProductsByCategoryHandle } from "@/lib/data/products";
import { canonicalListingPath, parsePage, parseSort } from "@/lib/search-params";
import { getSeoOverride } from "@/lib/data/seo";
import { siteUrl } from "@/lib/site-config";

type Props = {
  params: Promise<{ category: string; subcategory: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { subcategory: subHandle } = await params;
  const { page: pageParam } = await searchParams;
  const category = await getCategoryByHandle(subHandle);
  if (!category) return {};

  // Admin-editable SEO overrides (Admin-first platform, Phase B) — see the
  // parent category page's generateMetadata for why the canonical override
  // only applies to page 1.
  const seo = await getSeoOverride("category", category.id);
  const page = parsePage(pageParam);
  const title = seo?.seoTitle || category.name;
  const description =
    seo?.metaDescription || `${category.name} — ποιοτικά προϊόντα για το σπίτι σου, με γρήγορη παράδοση σε όλη την Ελλάδα.`;
  const path =
    page === 1 && seo?.canonicalUrl
      ? seo.canonicalUrl
      : canonicalListingPath(`/${category.parentHandle}/${category.handle}`, page);

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

export default async function SubcategoryPage({ params, searchParams }: Props) {
  const { category: parentHandle, subcategory: subHandle } = await params;
  const { sort: sortParam, page: pageParam } = await searchParams;

  const [parent, category] = await Promise.all([
    getCategoryByHandle(parentHandle),
    getCategoryByHandle(subHandle),
  ]);
  if (!parent || !category || category.parentHandle !== parentHandle) notFound();

  const sort = parseSort(sortParam);
  const page = parsePage(pageParam);

  const { products, count } = await getProductsByCategoryHandle(subHandle, {
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <CategoryPLPView
      title={category.name}
      description={`Ανακάλυψε τη συλλογή ${category.name.toLowerCase()} — επιλεγμένα προϊόντα για το σπίτι σου.`}
      breadcrumbs={[
        { label: parent.name, href: `/${parent.handle}` },
        { label: category.name, href: `/${parent.handle}/${category.handle}` },
      ]}
      products={products}
      count={count}
      sort={sort}
      page={page}
      basePath={`/${parent.handle}/${category.handle}`}
      source={{ type: "category", categoryHandle: subHandle }}
    />
  );
}
