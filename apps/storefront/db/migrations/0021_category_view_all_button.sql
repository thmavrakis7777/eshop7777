-- 0021_category_view_all_button.sql
--
-- Dashboard control for the mobile drill-down menu's "view all products in
-- this category" link (currently hardcoded per-render as "Δες τα όλα σε
-- {name}" in MobileMenu.tsx, first item of every level). Separate table from
-- shop.category_promo (0020) on purpose — the mega-menu desktop promo panel
-- and this mobile navigation link are unrelated features with independent
-- lifecycles; enabling/disabling one must never touch the other.
--
-- Unlike category_promo (main-category-only), this link can appear at ANY
-- depth the drill-down reaches — every category with children shows one —
-- so this table has no depth restriction. A real FK with ON DELETE CASCADE,
-- same reasoning as 0020: this only ever describes a category, so the
-- relationship is enforced by the database rather than a manual cleanup
-- step. Defaults (enabled=true, position='bottom') are the desired
-- out-of-the-box behavior for every category that has never had this row
-- explicitly configured — see fetchAllCategories()'s COALESCE.
CREATE TABLE IF NOT EXISTS shop.category_view_all_button (
  category_id  uuid PRIMARY KEY REFERENCES shop.category(id) ON DELETE CASCADE,
  enabled      boolean NOT NULL DEFAULT true,
  button_text  text,
  -- Only top/bottom today (explicitly de-scoped custom ordering) — a third
  -- 'custom' value plus a separate ordering scheme can extend this CHECK
  -- later without a migration that touches existing rows.
  position     text NOT NULL DEFAULT 'bottom' CHECK (position IN ('top', 'bottom')),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
