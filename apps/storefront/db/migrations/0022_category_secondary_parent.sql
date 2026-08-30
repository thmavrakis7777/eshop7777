-- 0022_category_secondary_parent.sql
--
-- True many-to-many category cross-listing: a category keeps exactly ONE
-- primary parent (shop.category.parent_id, unchanged — this is still what
-- determines the category's one canonical URL, its breadcrumb, and its
-- position in the sitemap) but can additionally be listed as a child of any
-- number of OTHER categories for navigation/discovery and product-listing
-- inheritance purposes.
--
-- Deliberately a plain edge table, not a "primary vs secondary" flag column
-- on shop.category itself: a category can have zero, one, or several extra
-- parents, which a single nullable column can't represent, and every other
-- per-category feature in this schema (category_promo, category_view_all_
-- button) already uses the same "small table keyed by category_id" shape.
--
-- Composite primary key (category_id, parent_category_id) is the uniqueness
-- constraint — the exact same relationship can't be inserted twice. Real
-- foreign keys with ON DELETE CASCADE in both directions: deleting either
-- category in a relationship removes the row automatically, so a deleted
-- category can never be left dangling as someone else's phantom secondary
-- parent. The CHECK blocks the one cycle a constraint can catch for free
-- (a category listing itself); longer cycles (A secondary-parents B, B
-- secondary-parents A, or a cycle through the primary parent_id chain) are
-- rejected at the application layer before insert — see
-- saveCategorySecondaryParents in lib/admin/taxonomy.ts — because detecting
-- those requires walking the graph, which a CHECK constraint cannot do.
CREATE TABLE IF NOT EXISTS shop.category_secondary_parent (
  category_id        uuid NOT NULL REFERENCES shop.category(id) ON DELETE CASCADE,
  parent_category_id uuid NOT NULL REFERENCES shop.category(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, parent_category_id),
  CONSTRAINT category_secondary_parent_not_self CHECK (category_id <> parent_category_id)
);

-- The category-page product query and the nav/mega-menu builder both look
-- up "which categories list X as a secondary parent" — the reverse
-- direction from the primary key's own natural index.
CREATE INDEX IF NOT EXISTS category_secondary_parent_parent_idx
  ON shop.category_secondary_parent (parent_category_id);
