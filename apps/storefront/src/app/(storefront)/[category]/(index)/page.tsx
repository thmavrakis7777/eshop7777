import type { Metadata } from "next";
import { CategoryRoute } from "@/components/category/CategoryRoute";
import { categoryMetadata } from "@/lib/category-route";

/**
 * Cached for everyone (ISR): no query string is read here. A URL with a
 * sort, page or filter is rewritten to the uncached /filtra copy of this
 * route instead (lib/category-rewrites.ts, PAGE_CACHING_SPEC.md B3).
 *
 * `revalidate` is the safety net only: dashboard saves already refresh the
 * cache at once (revalidatePath / updateTag). Next keeps the shortest
 * lifetime of the cached data the page reads, so some pages refresh sooner.
 * A literal, because Next reads route config at build time.
 */
export const revalidate = 3600;

// Empty: nothing is rendered at build. Each category is rendered on its
// first visit and cached from then on.
export async function generateStaticParams(): Promise<{ category: string }[]> {
  return [];
}

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  return categoryMetadata([category], undefined, {});
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  return <CategoryRoute segments={[category]} />;
}
