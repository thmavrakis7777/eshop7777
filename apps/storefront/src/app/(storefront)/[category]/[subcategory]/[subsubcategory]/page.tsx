import type { Metadata } from "next";
import { CategoryRoute } from "@/components/category/CategoryRoute";
import { categoryMetadata } from "@/lib/category-route";

type Props = {
  params: Promise<{ category: string; subcategory: string; subsubcategory: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category, subcategory, subsubcategory } = await params;
  const { page } = await searchParams;
  return categoryMetadata([category, subcategory, subsubcategory], page);
}

export default async function SubSubcategoryPage({ params, searchParams }: Props) {
  const { category, subcategory, subsubcategory } = await params;
  return <CategoryRoute segments={[category, subcategory, subsubcategory]} searchParams={searchParams} />;
}
