-- 0009_navigation.sql
--
-- Makes the main navigation owner-composed instead of "every top-level
-- category, in category order".
--
-- EXTENDS the existing shop.nav_item rather than adding a second table.
-- 0001_init created it with the comment "Makes header/footer navigation
-- editable, which it is not today" — an aspirational stub that was never
-- built out: it has always been empty and no code has ever read it. Its
-- id/parent_id/location/label/sort_order/is_active columns are exactly right
-- and are kept as they are.
--
-- What it lacked is a TYPED destination. A bare `href` could only express
-- "some URL", so the admin could not tell a category link from a collection
-- link from a hand-typed one, and could not offer a picker. Worse, storing
-- "/prosfores" for a sale link would make renaming that route a data
-- migration instead of a code change.
--
-- `href` is dropped rather than left alongside the new columns. The table is
-- empty and unreferenced, so this costs nothing, and keeping both would
-- create two sources of truth for one link with no rule for which wins.
--
-- Colours are nullable, validated #rrggbb. NULL means "inherit the header's
-- normal styling", which is what nearly every item wants; only something
-- like a red SALES chip sets them. The CHECK is a backstop — the Server
-- Action validates too, because a column can store a colour but cannot
-- police one — and the storefront only ever emits these as color/
-- backgroundColor values, never as arbitrary CSS.
--
-- An empty table means the storefront keeps its previous auto-generated
-- category nav. That fallback is permanent, not a transition step: a shop
-- with no nav items should have a working menu, not an empty header.

ALTER TABLE shop.nav_item
  DROP COLUMN IF EXISTS href,
  ADD COLUMN IF NOT EXISTS destination_type text NOT NULL DEFAULT 'custom'
    CHECK (destination_type IN
      ('category', 'collection', 'product', 'new_arrivals', 'sale', 'custom')),
  ADD COLUMN IF NOT EXISTS destination_value text,
  ADD COLUMN IF NOT EXISTS text_color text
    CHECK (text_color IS NULL OR text_color ~ '^#[0-9a-fA-F]{6}$'),
  ADD COLUMN IF NOT EXISTS background_color text
    CHECK (background_color IS NULL OR background_color ~ '^#[0-9a-fA-F]{6}$'),
  ADD COLUMN IF NOT EXISTS hover_color text
    CHECK (hover_color IS NULL OR hover_color ~ '^#[0-9a-fA-F]{6}$'),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- A slug/href destination without a value would render a link to nowhere;
-- the two fixed-route kinds must not carry one.
ALTER TABLE shop.nav_item
  DROP CONSTRAINT IF EXISTS nav_item_value_required;

ALTER TABLE shop.nav_item
  ADD CONSTRAINT nav_item_value_required CHECK (
    (destination_type IN ('new_arrivals', 'sale') AND destination_value IS NULL)
    OR (destination_type NOT IN ('new_arrivals', 'sale')
        AND destination_value IS NOT NULL AND length(trim(destination_value)) > 0)
  );

-- The storefront's only query: active header items in display order.
CREATE INDEX IF NOT EXISTS nav_item_active_order_idx
  ON shop.nav_item (location, sort_order, created_at) WHERE is_active;
