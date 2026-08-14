import "server-only";
import { sql } from "@/lib/db/client";
import type { Category, NavCategory } from "@/lib/types";

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

export async function getNavCategories(): Promise<NavCategory[]> {
  const all = await fetchAllCategories();
  return all
    .filter((c) => !c.parent_slug)
    .map((top) => ({
      ...toCategory(top),
      children: all.filter((c) => c.parent_slug === top.slug).map(toCategory),
      featured: FEATURED_COPY[top.slug],
    }));
}

export async function getCategoryByHandle(handle: string): Promise<Category | undefined> {
  const rows = await sql<CategoryRow[]>`
    SELECT c.id, c.slug, c.name, c.description, c.sort_order, p.slug AS parent_slug
      FROM shop.category c
      LEFT JOIN shop.category p ON p.id = c.parent_id
     WHERE c.slug = ${handle} AND c.is_active
     LIMIT 1`;
  return rows[0] ? toCategory(rows[0]) : undefined;
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
