import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db/client";
import type { Category, CategoryNode, FaqItem, NavCategory } from "@/lib/types";

// Invalidated by category/collection admin saves (taxonomy-actions.ts).
export const CATEGORY_CACHE_TAG = "categories";

type CategoryPromoRow = {
  category_id: string;
  image_path: string | null;
  title: string | null;
  description: string | null;
  button_text: string | null;
  destination_type: "all_products" | "sale";
};

// Only enabled panels — a disabled/never-configured category is meant to
// read as "no promo" everywhere downstream, not as a promo with blank
// fields. Cached the same way as the category rows themselves (60s,
// invalidated by CATEGORY_CACHE_TAG) since a dashboard save touches both.
//
// Returns a plain array, not a Map: unstable_cache round-trips its return
// value through JSON, which silently turns a Map into `{}` — confirmed live
// (a real `next build` TypeError, `.get is not a function`) rather than
// assumed. The Map is built after the cached call returns instead.
async function fetchEnabledCategoryPromos(): Promise<CategoryPromoRow[]> {
  return sql<CategoryPromoRow[]>`
    SELECT category_id, image_path, title, description, button_text, destination_type
      FROM shop.category_promo
     WHERE enabled`;
}

const getCachedCategoryPromos = unstable_cache(fetchEnabledCategoryPromos, ["category-promos"], {
  revalidate: 60,
  tags: [CATEGORY_CACHE_TAG],
});

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parent_slug: string | null;
  sort_order: number;
  page_type: string;
  image_path: string | null;
  faq: FaqItem[] | null;
};

// The tree query additionally carries each category's subtree product count;
// the single-row lookups below have no use for it and don't pay for it.
type CategoryTreeRow = CategoryRow & { product_count: number };

function toCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    name: r.name,
    handle: r.slug,
    parentHandle: r.parent_slug ?? undefined,
    description: r.description ?? undefined,
    pageType: r.page_type === "landing" ? "landing" : "products",
    imagePath: r.image_path,
    faq: r.faq,
  };
}

// One query for the whole tree, at every depth. The nav needs every category
// anyway, and at this size (~32 rows) fetching the lot once beats a query per
// level — which is what makes three-level navigation free rather than three
// times the cost. page_type/image_path/faq ride along on every row —
// negligible payload at this scale, and keeping one shared query/mapper for
// the whole module beats a second bespoke query just for the couple of routes
// that read them.
//
// `product_count` is each category's own products plus every active
// descendant's, computed in the same round trip by the `sub` CTE pairing each
// category with its subtree. That is exactly the set its listing page renders
// (getProductsByCategorySlug walks the same subtree), so a count shown next to
// a child link can never promise more products than clicking it delivers.
async function fetchAllCategories(): Promise<CategoryTreeRow[]> {
  return sql<CategoryTreeRow[]>`
    WITH RECURSIVE sub AS (
      SELECT c.id AS root_id, c.id FROM shop.category c WHERE c.is_active
      UNION ALL
      SELECT s.root_id, c.id
        FROM shop.category c JOIN sub s ON c.parent_id = s.id
       WHERE c.is_active
    ),
    counts AS (
      SELECT s.root_id, COUNT(*)::int AS n
        FROM sub s
        JOIN shop.product p ON p.category_id = s.id AND p.is_active
       GROUP BY s.root_id
    )
    SELECT c.id, c.slug, c.name, c.description, c.sort_order,
           c.page_type, c.image_path, c.faq, p.slug AS parent_slug,
           COALESCE(cnt.n, 0) AS product_count
      FROM shop.category c
      LEFT JOIN shop.category p ON p.id = c.parent_id
      LEFT JOIN counts cnt ON cnt.root_id = c.id
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
//
// The flat rows are what's cached, not the assembled tree: every consumer
// (nav, breadcrumbs, child pickers, sitemap) wants a different shape of the
// same 32 rows, and re-linking them in memory is far cheaper than caching
// several derived shapes or re-querying per shape.
const getCachedCategoryRows = unstable_cache(fetchAllCategories, ["category-rows"], {
  revalidate: 60,
  tags: [CATEGORY_CACHE_TAG],
});

/**
 * The active category forest, linked up to arbitrary depth, built once per
 * request from the single cached query.
 *
 * Branches are assembled by walking down from the roots rather than by
 * attaching every row to whatever parent slug it names. The difference
 * matters: a category whose parent has been deactivated is filtered out of
 * the rows, and a parent-first walk drops its descendants too, so hiding a
 * category hides its whole branch. Attaching by parent slug would instead
 * promote the orphan into a top-level category the owner never created.
 */
const getCategoryTree = cache(async (): Promise<CategoryNode[]> => {
  const rows = await getCachedCategoryRows();

  const nodes = new Map<string, CategoryNode>();
  const childSlugs = new Map<string, string[]>();
  for (const r of rows) {
    nodes.set(r.slug, { ...toCategory(r), children: [], productCount: r.product_count });
    if (r.parent_slug) {
      const siblings = childSlugs.get(r.parent_slug);
      if (siblings) siblings.push(r.slug);
      else childSlugs.set(r.parent_slug, [r.slug]);
    }
  }

  // Rows arrive already ordered by sort_order, so pushing children in row
  // order is what makes the dashboard's ordering hold at every level.
  const roots = rows.filter((r) => !r.parent_slug).map((r) => nodes.get(r.slug)!);
  const queue = [...roots];
  while (queue.length > 0) {
    const node = queue.shift()!;
    node.children = (childSlugs.get(node.handle) ?? []).map((slug) => nodes.get(slug)!);
    queue.push(...node.children);
  }

  return roots;
});

export const getNavCategories = cache(async (): Promise<NavCategory[]> => {
  const [roots, promoRows] = await Promise.all([getCategoryTree(), getCachedCategoryPromos()]);
  const promos = new Map(promoRows.map((r) => [r.category_id, r]));
  return roots.map((root): NavCategory => {
    const p = promos.get(root.id);
    if (!p) return { ...root, promo: undefined };
    return {
      ...root,
      promo: {
        imagePath: p.image_path,
        title: p.title,
        description: p.description,
        buttonText: p.button_text || "Δες τα προϊόντα",
        href: p.destination_type === "sale" ? `${categoryPathHref([], root)}?sale=1` : categoryPathHref([], root),
      },
    };
  });
});

/**
 * A category located by its full URL path, with everything a category page
 * needs to render: the ancestors for the breadcrumb and the direct children
 * for the "shop by category" picker.
 */
export type CategoryPath = {
  category: CategoryNode;
  /** Outermost first; empty for a top-level category. */
  ancestors: CategoryNode[];
  /** Direct children only — never the whole subtree (see the child picker). */
  children: CategoryNode[];
};

/**
 * Resolves ["kouzina", "mageirika-skeyi", "tigania"] to that category, at any
 * depth, from the one cached tree.
 *
 * Each segment must be a direct child of the one before it, so a category is
 * reachable at exactly one URL: /banio/tigania 404s instead of rendering pans
 * under bathroom, and /kouzina/tigania stops working the moment pans move
 * under cookware. That is what keeps the canonical URL honest — there is no
 * second path to the same page for a crawler to find.
 */
export async function getCategoryPath(segments: string[]): Promise<CategoryPath | undefined> {
  let level = await getCategoryTree();
  const chain: CategoryNode[] = [];

  for (const segment of segments) {
    const match = level.find((c) => c.handle === segment);
    if (!match) return undefined;
    chain.push(match);
    level = match.children;
  }

  const category = chain.at(-1);
  if (!category) return undefined;
  return { category, ancestors: chain.slice(0, -1), children: category.children };
}

/**
 * The chain from a root down to `handle`, inclusive — outermost first.
 *
 * What anything outside the category routes needs in order to link *to* a
 * category: the product page can't build a working URL from the category's
 * immediate parent alone, because a third-level category's URL contains its
 * grandparent too. Reads the same per-request tree the nav already loaded,
 * so it costs no query at all.
 */
export async function getCategoryTrail(handle: string): Promise<CategoryNode[] | undefined> {
  const find = (nodes: CategoryNode[], chain: CategoryNode[]): CategoryNode[] | undefined => {
    for (const node of nodes) {
      const next = [...chain, node];
      if (node.handle === handle) return next;
      const deeper = find(node.children, next);
      if (deeper) return deeper;
    }
    return undefined;
  };
  return find(await getCategoryTree(), []);
}

/** The canonical path for a category, given its ancestor chain. */
export function categoryPathHref(ancestors: Pick<Category, "handle">[], category: Pick<Category, "handle">): string {
  return `/${[...ancestors, category].map((c) => c.handle).join("/")}`;
}

// Four single-row/id lookups used to live here and are all gone, replaced by
// the cached tree above — which answers the same questions to any depth, and
// without a query, since the layout has already loaded it for the nav:
//
//   getCategoryByHandle, getCategoryWithParentByHandle — resolved a category
//     and (for the PDP breadcrumb) its immediate parent. getCategoryTrail
//     gives the whole ancestor chain instead, which is what a three-segment
//     URL actually needs.
//   getCategoryIdByHandle, getCategoryIdsForHandle — resolved a category id
//     and its subtree's ids. Removed in the 2026-08-19 audit with zero
//     callers left: product listing does the subtree walk inside
//     getProductsByCategorySlug's own recursive CTE, in the same query,
//     rather than resolving ids first and passing them back in (which is what
//     the Medusa version had to do, and why it only ever handled one level of
//     nesting).
//
// If you need a single category by handle, use getCategoryPath/getCategoryTrail
// rather than reintroducing a per-lookup query.
