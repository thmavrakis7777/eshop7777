import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db/client";
import type { Category, NavCategory } from "@/lib/types";

// Invalidated by category/collection admin saves (taxonomy-actions.ts).
export const CATEGORY_CACHE_TAG = "categories";

// Curated marketing copy for the mega menu's featured tile. Presentation
// content, not catalog data — it has no database equivalent and belongs here
// rather than in the category table. (Phase 10 moves this into the CMS so the
// store owner can edit it; until then it stays exactly as it was.)
const FEATURED_COPY: Record<string, NavCategory["featured"]> = {
  kouzina: { title: "Το σετ μαγειρικής της σεζόν", ctaLabel: "Δες τη συλλογή", href: "/kouzina" },
  "apothikefsi-organosi": { title: "Οργανώστε κάθε γωνιά του σπιτιού", ctaLabel: "Ανακάλυψε", href: "/apothikefsi-organosi" },
  banio: { title: "Ένα μπάνιο σαν spa", ctaLabel: "Δες τη συλλογή", href: "/banio" },
  katharismos: { title: "Καθαριότητα χωρίς κόπο", ctaLabel: "Δες τα προϊόντα", href: "/katharismos" },
  kipos: { title: "Ο κήπος σου, αναζωογονημένος", ctaLabel: "Δες τη συλλογή", href: "/kipos" },
  "eidi-spitiou": { title: "Διακόσμηση με χαρακτήρα", ctaLabel: "Ανακάλυψε", href: "/eidi-spitiou" },
};

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parent_slug: string | null;
  sort_order: number;
};

function toCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    name: r.name,
    handle: r.slug,
    parentHandle: r.parent_slug ?? undefined,
    description: r.description ?? undefined,
  };
}

// One query for the whole tree. The nav needs every category anyway, and at
// this size (28 rows) fetching the lot once beats a query per level.
async function fetchAllCategories(): Promise<CategoryRow[]> {
  return sql<CategoryRow[]>`
    SELECT c.id, c.slug, c.name, c.description, c.sort_order, p.slug AS parent_slug
      FROM shop.category c
      LEFT JOIN shop.category p ON p.id = c.parent_id
     WHERE c.is_active
     ORDER BY c.sort_order, c.name COLLATE "el-GR-x-icu"`;
}

// Every page renders this (root layout's Header + mega menu), and the
// homepage calls it a second time independently (page.tsx's own category
// tiles) — both uncached before this fix, so a single request could fire
// the same query twice and every request re-ran it regardless. `cache()`
// dedupes the two same-request calls; `unstable_cache` dedupes across
// requests for CATEGORY_CACHE_TAG's revalidate window, invalidated
// precisely by admin category/collection saves rather than waiting it out.
const getCachedNavCategories = unstable_cache(
  async (): Promise<NavCategory[]> => {
    const all = await fetchAllCategories();
    return all
      .filter((c) => !c.parent_slug)
      .map((top) => ({
        ...toCategory(top),
        children: all.filter((c) => c.parent_slug === top.slug).map(toCategory),
        featured: FEATURED_COPY[top.slug],
      }));
  },
  ["nav-categories"],
  { revalidate: 60, tags: [CATEGORY_CACHE_TAG] }
);

export const getNavCategories = cache(getCachedNavCategories);

export async function getCategoryByHandle(handle: string): Promise<Category | undefined> {
  const rows = await sql<CategoryRow[]>`
    SELECT c.id, c.slug, c.name, c.description, c.sort_order, p.slug AS parent_slug
      FROM shop.category c
      LEFT JOIN shop.category p ON p.id = c.parent_id
     WHERE c.slug = ${handle} AND c.is_active
     LIMIT 1`;
  return rows[0] ? toCategory(rows[0]) : undefined;
}

/**
 * A category plus its own parent (for the PDP's breadcrumb), in one query
 * instead of the two sequential round trips getting the parent's name used
 * to need — `parentHandle` is only known once `category` resolves, so it
 * was a genuine dependency, not one that could be parallelized away. A
 * second join reaching one level further up removes the dependency
 * entirely rather than just reordering it.
 */
export async function getCategoryWithParentByHandle(
  handle: string
): Promise<{ category: Category; parent?: Category } | undefined> {
  const rows = await sql<
    (CategoryRow & { parent_id: string | null; parent_name: string | null; parent_sort_order: number | null })[]
  >`
    SELECT c.id, c.slug, c.name, c.description, c.sort_order, p.slug AS parent_slug,
           p.id AS parent_id, p.name AS parent_name, p.sort_order AS parent_sort_order
      FROM shop.category c
      LEFT JOIN shop.category p ON p.id = c.parent_id
     WHERE c.slug = ${handle} AND c.is_active
     LIMIT 1`;
  const r = rows[0];
  if (!r) return undefined;
  return {
    category: toCategory(r),
    parent: r.parent_id
      ? { id: r.parent_id, name: r.parent_name!, handle: r.parent_slug!, description: undefined }
      : undefined,
  };
}

export async function getCategoryIdByHandle(handle: string): Promise<string | undefined> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM shop.category WHERE slug = ${handle} AND is_active LIMIT 1`;
  return rows[0]?.id;
}

/**
 * Every category id in a subtree — the category itself plus all descendants.
 *
 * Kept for callers that need the id list. Note that product listing no longer
 * goes through this: getProductsByCategorySlug does the subtree walk inside
 * its own recursive CTE, in the same query, instead of resolving ids first
 * and passing them back in (which is what the Medusa version had to do, and
 * why it only ever handled one level of nesting).
 */
export async function getCategoryIdsForHandle(handle: string): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    WITH RECURSIVE tree AS (
      SELECT id FROM shop.category WHERE slug = ${handle} AND is_active
      UNION ALL
      SELECT c.id FROM shop.category c JOIN tree t ON c.parent_id = t.id WHERE c.is_active
    )
    SELECT id FROM tree`;
  return rows.map((r) => r.id);
}
