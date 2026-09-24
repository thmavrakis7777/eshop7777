import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getCategoryPath } from "@/lib/data/categories";

/**
 * Keeps a missing category a real HTTP 404 now that category pages have a
 * loading skeleton (Speed audit SPD-04) — same reasoning as
 * proionta/[handle]/layout.tsx: a check inside the page runs after the
 * skeleton has streamed a 200, a check in a layout above it doesn't.
 *
 * One of these per depth ([subcategory]/layout.tsx and
 * [subsubcategory]/layout.tsx check their own full path), because a layout
 * only sees its own segment's params. For the same reason each depth's
 * loading.tsx lives in an `(index)` route group next to that depth's
 * page.tsx rather than directly in this folder: a loading.tsx here would
 * wrap the deeper layouts too, and a missing /kouzina/{x} would go back to
 * being a soft 404.
 *
 * getCategoryPath reads the cached category tree the root layout's nav has
 * already loaded on this request, so this costs no query — which matters
 * because prefetches of category links run it as well.
 */
export default async function CategoryExistsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!(await getCategoryPath([category]))) notFound();
  return children;
}
