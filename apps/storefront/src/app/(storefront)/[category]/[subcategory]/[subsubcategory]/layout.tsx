import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getCategoryPath } from "@/lib/data/categories";

// Real 404 for a missing third-level path — see [category]/layout.tsx. The
// deepest level needs no `(index)` group: nothing nests below it, and a
// loading.tsx never wraps the layout in its own folder.
export default async function SubSubcategoryExistsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ category: string; subcategory: string; subsubcategory: string }>;
}) {
  const { category, subcategory, subsubcategory } = await params;
  if (!(await getCategoryPath([category, subcategory, subsubcategory]))) notFound();
  return children;
}
