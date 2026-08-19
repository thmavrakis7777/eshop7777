import type { Metadata } from "next";
import { CategoryRoute } from "@/components/category/CategoryRoute";
import { categoryMetadata } from "@/lib/category-route";

type Props = {
  params: Promise<{ category: string; subcategory: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category, subcategory } = await params;
  const { page } = await searchParams;
  return categoryMetadata([category, subcategory], page);
}

export default async function SubcategoryPage({ params, searchParams }: Props) {
  const { category, subcategory } = await params;
  return <CategoryRoute segments={[category, subcategory]} searchParams={searchParams} />;
}
