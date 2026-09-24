import type { Metadata } from "next";
import { CategoryRoute } from "@/components/category/CategoryRoute";
import { categoryMetadata } from "@/lib/category-route";

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category } = await params;
  const sp = await searchParams;
  return categoryMetadata([category], sp.page as string | undefined, sp);
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  return <CategoryRoute segments={[category]} searchParams={searchParams} />;
}
