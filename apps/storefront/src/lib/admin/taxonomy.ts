import "server-only";
import { sql, transaction } from "@/lib/db/client";
import { MAX_CATEGORY_DEPTH } from "@/lib/category-depth";
import { normalizeSearchText } from "@/lib/search";
import type { FaqItem } from "@/lib/types";

/**
 * Categories, collections and inventory for the admin.
 *
 * Categories are a tree; collections are a flat set. They are separate
 * concepts on purpose: a product lives in exactly one category (its place in
 * the shop's structure) but any number of collections (a curated grouping
 * that can cut across the structure).
 */

export class TaxonomyError extends Error {
  constructor(
    message: string,
    public readonly code: "duplicate_slug" | "has_children" | "has_products" | "not_found" | "cycle" | "too_deep"
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type AdminCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  depth: number;
  productCount: number;
  childCount: number;
  // 'landing' renders curated service-page content instead of a product
  // grid — see migration 0010.
  pageType: "products" | "landing";
  imagePath: string | null;
  faq: FaqItem[] | null;
  // Mega-menu promotional panel (shop.category_promo) — meaningful for
  // top-level categories only (depth === 0), but read for every row so the
  // edit form always shows whatever is already saved even if a category was
  // re-parented after its promo was configured.
  megaMenuEnabled: boolean;
  megaMenuImagePath: string | null;
  megaMenuTitle: string | null;
  megaMenuDescription: string | null;
  megaMenuButtonText: string | null;
  megaMenuDestinationType: "all_products" | "sale";
  // Mobile drill-down menu's "view all products" link
  // (shop.category_view_all_button) — unlike the mega-menu promo above,
  // applies at every depth (any category with children shows this link),
  // so it is not gated to depth === 0 anywhere.
  viewAllEnabled: boolean;
  viewAllButtonText: string | null;
  viewAllPosition: "top" | "bottom";
};

/**
 * The whole tree in one recursive CTE, ordered by materialised path so
 * children always follow their parent and siblings respect sort_order.
 * `productCount` counts only direct members, not descendants — an operator
 * moving a product needs to know where it actually sits.
 */
export async function listCategoryTree(): Promise<AdminCategory[]> {
  const rows = await sql<
    {
      id: string; slug: string; name: string; description: string | null;
      parent_id: string | null; sort_order: number; is_active: boolean;
      page_type: string; image_path: string | null; faq: FaqItem[] | null;
      depth: number; product_count: number; child_count: number;
      megamenu_enabled: boolean; megamenu_image_path: string | null;
      megamenu_title: string | null; megamenu_description: string | null;
      megamenu_button_text: string | null; megamenu_destination_type: string;
      view_all_enabled: boolean; view_all_button_text: string | null; view_all_position: string;
    }[]
  >`
    WITH RECURSIVE tree AS (
      SELECT c.id, c.slug, c.name, c.description, c.parent_id, c.sort_order, c.is_active,
             c.page_type, c.image_path, c.faq,
             0 AS depth,
             LPAD(c.sort_order::text, 6, '0') || c.name AS path
        FROM shop.category c WHERE c.parent_id IS NULL
      UNION ALL
      SELECT c.id, c.slug, c.name, c.description, c.parent_id, c.sort_order, c.is_active,
             c.page_type, c.image_path, c.faq,
             t.depth + 1,
             t.path || '/' || LPAD(c.sort_order::text, 6, '0') || c.name
        FROM shop.category c JOIN tree t ON c.parent_id = t.id
    )
    SELECT t.*,
      (SELECT COUNT(*) FROM shop.product p WHERE p.category_id = t.id)::int AS product_count,
      (SELECT COUNT(*) FROM shop.category c2 WHERE c2.parent_id = t.id)::int AS child_count,
      COALESCE(cp.enabled, false) AS megamenu_enabled,
      cp.image_path AS megamenu_image_path,
      cp.title AS megamenu_title,
      cp.description AS megamenu_description,
      cp.button_text AS megamenu_button_text,
      COALESCE(cp.destination_type, 'all_products') AS megamenu_destination_type,
      COALESCE(vab.enabled, true) AS view_all_enabled,
      vab.button_text AS view_all_button_text,
      COALESCE(vab.position, 'bottom') AS view_all_position
    FROM tree t
    LEFT JOIN shop.category_promo cp ON cp.category_id = t.id
    LEFT JOIN shop.category_view_all_button vab ON vab.category_id = t.id
    ORDER BY t.path COLLATE "el-GR-x-icu"`;

  return rows.map((r) => ({
    id: r.id, slug: r.slug, name: r.name, description: r.description,
    parentId: r.parent_id, sortOrder: r.sort_order, isActive: r.is_active,
    pageType: r.page_type === "landing" ? "landing" : "products",
    imagePath: r.image_path, faq: r.faq,
    depth: r.depth, productCount: r.product_count, childCount: r.child_count,
    megaMenuEnabled: r.megamenu_enabled,
    megaMenuImagePath: r.megamenu_image_path,
    megaMenuTitle: r.megamenu_title,
    megaMenuDescription: r.megamenu_description,
    megaMenuButtonText: r.megamenu_button_text,
    megaMenuDestinationType: r.megamenu_destination_type === "sale" ? "sale" : "all_products",
    viewAllEnabled: r.view_all_enabled,
    viewAllButtonText: r.view_all_button_text,
    viewAllPosition: r.view_all_position === "top" ? "top" : "bottom",
  }));
}

/**
 * Upserts the mega-menu promotional panel for one category. A real 1:1 table
 * (see 0020_category_promo.sql) rather than an all-fields-required call
 * through saveCategory() — that function's signature is the base category
 * record, and adding six presentation-only fields to it would risk a caller
 * clobbering them by omission. Called unconditionally with `enabled: false`
 * clears/disables an existing panel without deleting the row, which is fine:
 * a disabled row is indistinguishable from "no row" to every storefront
 * reader (see fetchEnabledCategoryPromos in lib/data/categories.ts).
 */
export async function saveCategoryMegaMenuPromo(
  categoryId: string,
  input: {
    enabled: boolean;
    imagePath: string | null;
    title: string | null;
    description: string | null;
    buttonText: string | null;
    destinationType: "all_products" | "sale";
  }
): Promise<void> {
  await sql`
    INSERT INTO shop.category_promo
      (category_id, enabled, image_path, title, description, button_text, destination_type, updated_at)
    VALUES
      (${categoryId}, ${input.enabled}, ${input.imagePath}, ${input.title}, ${input.description},
       ${input.buttonText}, ${input.destinationType}, now())
    ON CONFLICT (category_id) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      image_path = EXCLUDED.image_path,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      button_text = EXCLUDED.button_text,
      destination_type = EXCLUDED.destination_type,
      updated_at = now()`;
}

/**
 * Upserts the mobile drill-down menu's "view all products in this category"
 * link config. Same upsert-not-delete pattern and same reasoning as
 * saveCategoryMegaMenuPromo above, in its own table (0021) — a completely
 * separate feature from the mega-menu promo, not a variant of it.
 */
export async function saveCategoryViewAllButton(
  categoryId: string,
  input: { enabled: boolean; buttonText: string | null; position: "top" | "bottom" }
): Promise<void> {
  await sql`
    INSERT INTO shop.category_view_all_button (category_id, enabled, button_text, position, updated_at)
    VALUES (${categoryId}, ${input.enabled}, ${input.buttonText}, ${input.position}, now())
    ON CONFLICT (category_id) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      button_text = EXCLUDED.button_text,
      position = EXCLUDED.position,
      updated_at = now()`;
}

export async function saveCategory(input: {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  pageType: "products" | "landing";
  imagePath: string | null;
  faq: FaqItem[] | null;
}): Promise<string> {
  const dupe = await sql<{ id: string }[]>`
    SELECT id FROM shop.category
     WHERE slug = ${input.slug} ${input.id ? sql`AND id <> ${input.id}` : sql``}`;
  if (dupe.length > 0) throw new TaxonomyError("Slug already in use", "duplicate_slug");

  if (input.id) {
    // A category cannot become its own descendant's child — that would make
    // the tree unwalkable and the recursive CTE loop forever.
    if (input.parentId) {
      if (input.parentId === input.id) throw new TaxonomyError("Category cannot be its own parent", "cycle");
      const [{ isDescendant }] = await sql<{ isDescendant: boolean }[]>`
        WITH RECURSIVE sub AS (
          SELECT id FROM shop.category WHERE id = ${input.id}
          UNION ALL
          SELECT c.id FROM shop.category c JOIN sub s ON c.parent_id = s.id
        )
        SELECT EXISTS (SELECT 1 FROM sub WHERE id = ${input.parentId}) AS "isDescendant"`;
      if (isDescendant) throw new TaxonomyError("Cannot nest a category inside its own subtree", "cycle");
    }
    await assertDepthFits(input.parentId, input.id);

    await sql`
      UPDATE shop.category SET
        name = ${input.name}, slug = ${input.slug}, description = ${input.description},
        parent_id = ${input.parentId}, sort_order = ${input.sortOrder}, is_active = ${input.isActive},
        page_type = ${input.pageType}, image_path = ${input.imagePath}, faq = ${faqJson(input.faq)}
      WHERE id = ${input.id}`;
    return input.id;
  }

  await assertDepthFits(input.parentId, undefined);

  const [row] = await sql<{ id: string }[]>`
    INSERT INTO shop.category (name, slug, description, parent_id, sort_order, is_active,
                                page_type, image_path, faq)
    VALUES (${input.name}, ${input.slug}, ${input.description}, ${input.parentId},
            ${input.sortOrder}, ${input.isActive},
            ${input.pageType}, ${input.imagePath}, ${faqJson(input.faq)})
    RETURNING id`;
  return row.id;
}

/**
 * Refuses a parent that would push the category — or anything already
 * beneath it — past MAX_CATEGORY_DEPTH.
 *
 * Both halves matter. Re-parenting a leaf only needs the new parent's own
 * depth, but re-parenting a branch drags its whole subtree down with it, so
 * the check is against the *tallest* thing being moved, not the node the
 * operator clicked. Skipping that would let a legal-looking move strand every
 * grandchild at an unroutable URL.
 */
/**
 * Single-column update for the AI SEO-GEO flow (ai-category-seo-actions.ts)
 * — deliberately not routed through `saveCategory`, which requires every
 * field and would risk clobbering name/slug/parent/etc. if any of those were
 * ever wired up wrong on the caller's side.
 */
export async function updateCategoryDescription(id: string, description: string | null): Promise<void> {
  await sql`UPDATE shop.category SET description = ${description}, updated_at = now() WHERE id = ${id}`;
}

async function assertDepthFits(parentId: string | null, movingId: string | undefined): Promise<void> {
  if (!parentId) return;

  const [{ depth }] = await sql<{ depth: number }[]>`
    WITH RECURSIVE up AS (
      SELECT id, parent_id, 0 AS d FROM shop.category WHERE id = ${parentId}
      UNION ALL
      SELECT c.id, c.parent_id, up.d + 1 FROM shop.category c JOIN up ON c.id = up.parent_id
    )
    SELECT COALESCE(MAX(d), 0)::int AS depth FROM up`;

  const height = movingId
    ? (
        await sql<{ height: number }[]>`
          WITH RECURSIVE down AS (
            SELECT id, 0 AS d FROM shop.category WHERE id = ${movingId}
            UNION ALL
            SELECT c.id, down.d + 1 FROM shop.category c JOIN down ON c.parent_id = down.id
          )
          SELECT COALESCE(MAX(d), 0)::int AS height FROM down`
      )[0].height
    : 0;

  if (depth + 1 + height > MAX_CATEGORY_DEPTH) {
    throw new TaxonomyError("Category nesting is limited to three levels", "too_deep");
  }
}

// postgres.js's JSONValue type doesn't accept an arbitrary array shape;
// the FAQ list really is plain JSON, so this cast is the honest narrowing
// (same pattern as saveHomepageBlock's `config` column).
function faqJson(faq: FaqItem[] | null) {
  return faq ? sql.json(faq as unknown as Parameters<typeof sql.json>[0]) : null;
}

/**
 * Refuses rather than cascades. Deleting a category with children would
 * orphan a whole branch; deleting one with products would silently
 * uncategorise them. Both are recoverable mistakes only if they never happen.
 *
 * `shop.seo_meta` has no FK to `shop.category` — it is a polymorphic
 * association shared with products/pages/collections/homepage, so nothing
 * enforces this automatically. Once the category itself is gone, its SEO
 * override becomes an unreachable row (never shown by `listCategorySeo`,
 * which starts FROM the category table), so nothing broken is user-visible —
 * but it would sit as dead data forever otherwise. Deleted in the same
 * transaction, not as a cleanup job.
 */
export async function deleteCategory(id: string): Promise<void> {
  const [counts] = await sql<{ children: number; products: number }[]>`
    SELECT (SELECT COUNT(*) FROM shop.category WHERE parent_id = ${id})::int AS children,
           (SELECT COUNT(*) FROM shop.product WHERE category_id = ${id})::int AS products`;
  if (counts.children > 0) throw new TaxonomyError("Category has subcategories", "has_children");
  if (counts.products > 0) throw new TaxonomyError("Category has products", "has_products");

  await transaction(async (tx) => {
    await tx`DELETE FROM shop.seo_meta WHERE resource_type = 'category' AND resource_id = ${id}`;
    await tx`DELETE FROM shop.category WHERE id = ${id}`;
  });
}

export async function moveCategory(id: string, direction: "up" | "down"): Promise<void> {
  await transaction(async (tx) => {
    const [self] = await tx<{ parent_id: string | null; sort_order: number }[]>`
      SELECT parent_id, sort_order FROM shop.category WHERE id = ${id}`;
    if (!self) throw new TaxonomyError("Category not found", "not_found");

    // Swap with the adjacent sibling rather than renumbering the whole level —
    // two UPDATEs instead of N, and stable for anything not being moved.
    const [neighbour] = await tx<{ id: string; sort_order: number }[]>`
      SELECT id, sort_order FROM shop.category
       WHERE parent_id IS NOT DISTINCT FROM ${self.parent_id} AND id <> ${id}
         ${direction === "up"
           ? sql`AND sort_order <= ${self.sort_order} ORDER BY sort_order DESC`
           : sql`AND sort_order >= ${self.sort_order} ORDER BY sort_order ASC`}
       LIMIT 1`;
    if (!neighbour) return;

    // Equal sort_order values are common in imported data; nudge instead of
    // swapping identical numbers, which would be a no-op.
    const a = self.sort_order;
    const b = neighbour.sort_order;
    const [newSelf, newNeighbour] = a === b ? (direction === "up" ? [a - 1, b] : [a + 1, b]) : [b, a];

    await tx`UPDATE shop.category SET sort_order = ${newSelf} WHERE id = ${id}`;
    await tx`UPDATE shop.category SET sort_order = ${newNeighbour} WHERE id = ${neighbour.id}`;
  });
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export type AdminCollection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

export async function listCollections(): Promise<AdminCollection[]> {
  const rows = await sql<
    {
      id: string; slug: string; title: string; description: string | null;
      sort_order: number; is_active: boolean; product_count: number;
    }[]
  >`SELECT c.id, c.slug, c.title, c.description, c.sort_order, c.is_active,
           (SELECT COUNT(*) FROM shop.product_collection pc WHERE pc.collection_id = c.id)::int AS product_count
      FROM shop.collection c
     ORDER BY c.sort_order, c.title COLLATE "el-GR-x-icu"`;

  return rows.map((r) => ({
    id: r.id, slug: r.slug, title: r.title, description: r.description,
    sortOrder: r.sort_order, isActive: r.is_active, productCount: r.product_count,
  }));
}

export async function saveCollection(input: {
  id?: string;
  title: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}): Promise<string> {
  const dupe = await sql<{ id: string }[]>`
    SELECT id FROM shop.collection
     WHERE slug = ${input.slug} ${input.id ? sql`AND id <> ${input.id}` : sql``}`;
  if (dupe.length > 0) throw new TaxonomyError("Slug already in use", "duplicate_slug");

  if (input.id) {
    await sql`
      UPDATE shop.collection SET
        title = ${input.title}, slug = ${input.slug}, description = ${input.description},
        sort_order = ${input.sortOrder}, is_active = ${input.isActive}
      WHERE id = ${input.id}`;
    return input.id;
  }
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO shop.collection (title, slug, description, sort_order, is_active)
    VALUES (${input.title}, ${input.slug}, ${input.description}, ${input.sortOrder}, ${input.isActive})
    RETURNING id`;
  return row.id;
}

/**
 * Safe to delete outright, unlike a category: membership lives in a join
 * table, so removing a collection detaches products without changing them.
 */
export async function deleteCollection(id: string): Promise<void> {
  await sql`DELETE FROM shop.collection WHERE id = ${id}`;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export type InventoryRow = {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  stock: number;
  allowBackorder: boolean;
  isActive: boolean;
  reservedInCarts: number;
  // Whether the parent product has more than one variant. Single-variant
  // products carry a meaningless inherited title ("Μόνη επιλογή" from the
  // Medusa import, "Default" for new ones) that would be noise on every row.
  hasSiblings: boolean;
};

export async function listInventory(filters: { q?: string; view?: "all" | "low" | "out" } = {}): Promise<InventoryRow[]> {
  const q = filters.q?.trim();
  const folded = q ? normalizeSearchText(q) : null;

  const rows = (await sql`
    SELECT v.id AS variant_id, p.id AS product_id, p.title AS product_title,
           v.title AS variant_title, v.sku, v.stock_quantity, v.allow_backorder, v.is_active,
           COALESCE((
             SELECT SUM(ci.quantity) FROM shop.cart_item ci
               JOIN shop.cart c ON c.id = ci.cart_id
              WHERE ci.variant_id = v.id AND c.status = 'active'), 0)::int AS reserved_in_carts,
           (SELECT COUNT(*) > 1 FROM shop.product_variant v2 WHERE v2.product_id = p.id) AS has_siblings
      FROM shop.product_variant v
      JOIN shop.product p ON p.id = v.product_id
     WHERE TRUE
       ${filters.view === "out" ? sql`AND NOT v.allow_backorder AND v.stock_quantity <= 0` : sql``}
       ${filters.view === "low"
         ? sql`AND NOT v.allow_backorder AND v.stock_quantity > 0 AND v.stock_quantity <= 5`
         : sql``}
       ${folded
         ? sql`AND (translate(lower(p.title), 'άέήίόύώΐΰϊϋς', 'αεηιουωιυιυσ') LIKE ${"%" + folded + "%"}
                    OR v.sku ILIKE ${"%" + q + "%"})`
         : sql``}
     ORDER BY v.stock_quantity ASC, p.title COLLATE "el-GR-x-icu"
     LIMIT 300`) as unknown as Array<{
    variant_id: string; product_id: string; product_title: string; variant_title: string;
    sku: string; stock_quantity: number; allow_backorder: boolean; is_active: boolean;
    reserved_in_carts: number; has_siblings: boolean;
  }>;

  return rows.map((r) => ({
    variantId: r.variant_id,
    productId: r.product_id,
    productTitle: r.product_title,
    variantTitle: r.variant_title,
    sku: r.sku,
    stock: r.stock_quantity,
    allowBackorder: r.allow_backorder,
    isActive: r.is_active,
    reservedInCarts: r.reserved_in_carts,
    hasSiblings: r.has_siblings,
  }));
}

export type StockMovement = {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  createdAt: string;
  orderNumber: number | null;
};

export async function listStockMovements(variantId: string, limit = 20): Promise<StockMovement[]> {
  const rows = await sql<
    { id: string; delta: number; reason: string; note: string | null; created_at: Date; order_number: number | null }[]
  >`SELECT m.id, m.delta, m.reason, m.note, m.created_at, o.order_number
      FROM shop.inventory_movement m
      LEFT JOIN shop.orders o ON o.id = m.order_id
     WHERE m.variant_id = ${variantId}
     ORDER BY m.created_at DESC LIMIT ${limit}`;

  return rows.map((r) => ({
    id: r.id,
    delta: r.delta,
    reason: r.reason,
    note: r.note,
    createdAt: new Date(r.created_at).toISOString(),
    orderNumber: r.order_number,
  }));
}
