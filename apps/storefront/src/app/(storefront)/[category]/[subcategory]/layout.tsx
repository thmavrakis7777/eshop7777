import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getCategoryPath } from "@/lib/data/categories";

// Real 404 for a missing /{category}/{subcategory} — see [category]/layout.tsx.
export default async function SubcategoryExistsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ category: string; subcategory: string }>;
}) {
  const { category, subcategory } = await params;
  if (!(await getCategoryPath([category, subcategory]))) notFound();
  return children;
}
