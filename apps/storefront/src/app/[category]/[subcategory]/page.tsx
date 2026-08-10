import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPLPView, PAGE_SIZE } from "@/components/category/CategoryPLPView";
import { getCategoryByHandle } from "@/lib/data/categories";
import { getProductsByCategoryHandle } from "@/lib/data/products";
import { canonicalListingPath, parsePage, parseSort } from "@/lib/search-params";
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

  const title = category.name;
  const description = `${category.name} — ποιοτικά προϊόντα για το σπίτι σου, με γρήγορη παράδοση σε όλη την Ελλάδα.`;
  const path = canonicalListingPath(`/${category.parentHandle}/${category.handle}`, parsePage(pageParam));

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: `${siteUrl}${path}` },
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
