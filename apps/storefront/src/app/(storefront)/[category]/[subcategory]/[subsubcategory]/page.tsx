import type { Metadata } from "next";
import { CategoryRoute } from "@/components/category/CategoryRoute";
import { categoryMetadata } from "@/lib/category-route";

// Cached like the top-level category page; see [category]/(index)/page.tsx.
export const revalidate = 3600;

export async function generateStaticParams(): Promise<
  { category: string; subcategory: string; subsubcategory: string }[]
> {
  return [];
}

type Props = { params: Promise<{ category: string; subcategory: string; subsubcategory: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, subcategory, subsubcategory } = await params;
  return categoryMetadata([category, subcategory, subsubcategory], undefined, {});
}

export default async function SubSubcategoryPage({ params }: Props) {
  const { category, subcategory, subsubcategory } = await params;
  return <CategoryRoute segments={[category, subcategory, subsubcategory]} />;
}
