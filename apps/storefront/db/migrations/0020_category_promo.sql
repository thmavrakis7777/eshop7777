-- 0020_category_promo.sql
--
-- Dashboard-managed mega-menu promotional panel for main categories. The
-- mega menu's "featured" tile previously existed only as hardcoded
-- TypeScript (FEATURED_COPY in lib/data/categories.ts, four categories,
-- editable only by changing code) — this replaces it with real,
-- owner-editable data.
--
-- A dedicated 1:1 table rather than columns on shop.category itself: this
-- is optional presentation content that only ever applies to top-level
-- categories, and every row of shop.category (read for the nav,
-- breadcrumbs, and every product listing) would otherwise carry six mostly-
-- empty columns. Unlike shop.seo_meta's polymorphic (resource_type,
-- resource_id) design — shared across products/pages/collections/homepage,
-- so it can't hold a real foreign key — this table only ever describes a
-- category, so a real FK with ON DELETE CASCADE replaces seo_meta's manual
-- same-transaction delete: the relationship is enforced by the database
-- itself, not by every future caller remembering to clean up.
CREATE TABLE IF NOT EXISTS shop.category_promo (
  category_id      uuid PRIMARY KEY REFERENCES shop.category(id) ON DELETE CASCADE,
  enabled          boolean NOT NULL DEFAULT false,
  image_path       text,
  title            text,
  description      text,
  button_text      text,
  destination_type text NOT NULL DEFAULT 'all_products'
                     CHECK (destination_type IN ('all_products', 'sale')),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
