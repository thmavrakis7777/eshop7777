import type { Metadata } from "next";
import { CategoryRoute } from "@/components/category/CategoryRoute";
import { categoryMetadata } from "@/lib/category-route";

// Uncached filtered copy; see filtra/[category]/page.tsx.

type Props = {
  params: Promise<{ category: string; subcategory: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category, subcategory } = await params;
  const sp = await searchParams;
  return categoryMetadata([category, subcategory], sp.page as string | undefined, sp);
}

export default async function FilteredSubcategoryPage({ params, searchParams }: Props) {
  const { category, subcategory } = await params;
  return <CategoryRoute segments={[category, subcategory]} searchParams={searchParams} />;
}
