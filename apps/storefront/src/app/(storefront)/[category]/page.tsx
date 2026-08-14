import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPLPView, PAGE_SIZE } from "@/components/category/CategoryPLPView";
import { getCategoryByHandle, getNavCategories } from "@/lib/data/categories";
import { getProductsByCategoryHandle } from "@/lib/data/products";
import { canonicalListingPath, parsePage, parseSort } from "@/lib/search-params";
import { getSeoOverride } from "@/lib/data/seo";
import { siteUrl } from "@/lib/site-config";

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category: categoryHandle } = await params;
  const { page: pageParam } = await searchParams;
  const category = await getCategoryByHandle(categoryHandle);
  if (!category) return {};

  // Admin-editable SEO overrides (Admin-first platform, Phase B) — same
  // fallback pattern as product SEO. The canonical override only applies to
  // page 1: deeper pages must keep self-canonicalising to their own ?page=N
  // URL (see canonicalListingPath), or Google would see every page as a
  // duplicate of an admin-picked URL instead of a distinct, indexable page.
  const seo = await getSeoOverride("category", category.id);
  const page = parsePage(pageParam);
  const title = seo?.seoTitle || category.name;
  const description =
    seo?.metaDescription || `${category.name} — ποιοτικά προϊόντα για το σπίτι σου, με γρήγορη παράδοση σε όλη την Ελλάδα.`;
  const path =
    page === 1 && seo?.canonicalUrl ? seo.canonicalUrl : canonicalListingPath(`/${category.handle}`, page);

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

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category: categoryHandle } = await params;
  const { sort: sortParam, page: pageParam } = await searchParams;

  const [category, navCategories] = await Promise.all([
    getCategoryByHandle(categoryHandle),
    getNavCategories(),
  ]);
  if (!category || category.parentHandle) notFound();

  const navEntry = navCategories.find((c) => c.handle === categoryHandle);
  const sort = parseSort(sortParam);
  const page = parsePage(pageParam);

  const { products, count } = await getProductsByCategoryHandle(categoryHandle, {
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <CategoryPLPView
      title={category.name}
      description={`Ανακάλυψε τη συλλογή ${category.name.toLowerCase()} — επιλεγμένα προϊόντα για το σπίτι σου.`}
      breadcrumbs={[{ label: category.name, href: `/${category.handle}` }]}
      subcategories={navEntry?.children.map((c) => ({ label: c.name, href: `/${category.handle}/${c.handle}` }))}
      products={products}
      count={count}
      sort={sort}
      page={page}
      basePath={`/${category.handle}`}
      source={{ type: "category", categoryHandle }}
    />
  );
}
