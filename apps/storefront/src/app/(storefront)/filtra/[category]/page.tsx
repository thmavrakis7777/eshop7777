import type { Metadata } from "next";
import { CategoryRoute } from "@/components/category/CategoryRoute";
import { categoryMetadata } from "@/lib/category-route";

/**
 * The uncached copy of a category page, for URLs with a sort, page or
 * filter. Nobody links here: next.config.ts rewrites /kouzina?sort=… to
 * /filtra/kouzina?sort=… internally, so the address bar keeps the real URL
 * (lib/category-rewrites.ts, PAGE_CACHING_SPEC.md B3). Reading searchParams
 * makes these render per request, which is the point: the plain category
 * pages can then be cached.
 *
 * Canonical and robots come from categoryMetadata, built from the category's
 * own path, never from /filtra: filtered views are noindex, page N
 * canonicalises to /kouzina?page=N. A visit typed straight to /filtra/…
 * therefore points search engines at the real URL.
 */

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category } = await params;
  const sp = await searchParams;
  return categoryMetadata([category], sp.page as string | undefined, sp);
}

export default async function FilteredCategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  return <CategoryRoute segments={[category]} searchParams={searchParams} />;
}
