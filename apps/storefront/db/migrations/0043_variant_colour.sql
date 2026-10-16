-- Colour variants (owner, 2026-10-16 — COLOR_VARIANTS_SPEC.md): the gas
-- stoves come in several colours, each with its own stock, and shoppers pick
-- the colour on the product page and on the product card itself.
--
-- swatch_hex: the colour dot shown to shoppers. Set = this variant is a
-- colour (its title is the colour's name, «Κόκκινο»). NULL for every
-- existing variant, so nothing changes for products without colours.
-- A plain column rather than the (still empty) product_option tables:
-- colour is the only axis any real product has, see MIGRATION_PLAN.md §1.
--
-- image_id: the product photo that shows this colour — the card and the
-- product page switch to it when the colour is picked. SET NULL when the
-- photo is deleted: the colour stays on sale, it just shows the main photo.
ALTER TABLE shop.product_variant
  ADD COLUMN IF NOT EXISTS swatch_hex text
    CHECK (swatch_hex IS NULL OR swatch_hex ~ '^#[0-9a-f]{6}$'),
  ADD COLUMN IF NOT EXISTS image_id uuid
    REFERENCES shop.product_image(id) ON DELETE SET NULL;
