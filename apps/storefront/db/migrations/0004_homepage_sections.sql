-- 0004_homepage_sections.sql
--
-- Turns homepage_block from "two fixed kinds with one flat field set" into a
-- real section system the store owner composes themselves.
--
-- Before: kind IN ('hero','promo'), and the homepage's actual structure
-- (category grid, Featured rail, New Arrivals rail) was hardcoded in
-- page.tsx — the admin could edit two banners and nothing else. Sections
-- could not be added, removed, reordered or hidden.
--
-- Design (chosen deliberately over one-column-per-field and
-- one-table-per-kind): keep the shared presentational columns every kind
-- uses (eyebrow/heading/body/cta/image/sort_order/is_published) and put the
-- per-kind extras in a single `config` jsonb. New section types then cost a
-- TypeScript type and an admin form, not a migration. The trade-off is real
-- and accepted: `config`'s shape is validated in application code (Zod in
-- the Server Action), not by the database.
--
-- `sort_order` becomes GLOBAL rather than per-kind — the homepage is now one
-- ordered list of sections, so a category grid can sit above or below a
-- product rail. The old (kind, sort_order) index is replaced accordingly.
-- Existing rows keep their data and their order within their kind.

-- 1. New section kinds. CHECK swap is cheap and additive: every existing
--    row is 'hero' or 'promo', both still valid.
ALTER TABLE shop.homepage_block
  DROP CONSTRAINT IF EXISTS homepage_block_kind_check;

ALTER TABLE shop.homepage_block
  ADD CONSTRAINT homepage_block_kind_check
  CHECK (kind IN ('hero', 'promo', 'category_grid', 'product_rail', 'content'));

-- 2. Per-kind configuration. Empty object, never NULL, so application code
--    never needs a null check before reading a key.
ALTER TABLE shop.homepage_block
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. Mobile art direction — a separate crop for narrow viewports rather than
--    letting the desktop image scale down badly. Its own column (not config)
--    because it is the direct sibling of the existing image_path and is
--    resolved through the same publicImageUrl() path.
ALTER TABLE shop.homepage_block
  ADD COLUMN IF NOT EXISTS mobile_image_path text,
  ADD COLUMN IF NOT EXISTS image_alt text;

-- 4. Global ordering. The old index was (kind, sort_order), which only
--    supported "list the hero blocks" / "list the promo blocks"; the
--    storefront now reads every published section in one ordered pass.
DROP INDEX IF EXISTS shop.homepage_block_kind_idx;
CREATE INDEX IF NOT EXISTS homepage_block_order_idx
  ON shop.homepage_block (sort_order, created_at);

-- 5. Give existing rows a deterministic global order instead of two
--    independent per-kind sequences that would otherwise interleave
--    arbitrarily: heroes first (they were always rendered at the top),
--    then promos, preserving each group's existing relative order.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (
    ORDER BY CASE kind WHEN 'hero' THEN 0 ELSE 1 END, sort_order, created_at
  ) * 10 AS new_order
  FROM shop.homepage_block
)
UPDATE shop.homepage_block b
   SET sort_order = o.new_order
  FROM ordered o
 WHERE b.id = o.id;
