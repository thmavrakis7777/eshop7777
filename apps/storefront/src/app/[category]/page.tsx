import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPLPView, PAGE_SIZE } from "@/components/category/CategoryPLPView";
import { getCategoryByHandle, getNavCategories } from "@/lib/data/categories";
import { getProductsByCategoryHandle } from "@/lib/data/products";
import { canonicalListingPath, parsePage, parseSort } from "@/lib/search-params";
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

  const title = category.name;
  const description = `${category.name} — ποιοτικά προϊόντα για το σπίτι σου, με γρήγορη παράδοση σε όλη την Ελλάδα.`;
  const path = canonicalListingPath(`/${category.handle}`, parsePage(pageParam));

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: `${siteUrl}${path}` },
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
    />
  );
}
