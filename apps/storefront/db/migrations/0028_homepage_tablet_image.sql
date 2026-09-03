-- Adds a tablet-tier image alongside the existing desktop (image_path) and
-- mobile (mobile_image_path) columns on shop.homepage_block. Nullable, no
-- default beyond NULL, so every existing row is completely unaffected —
-- rendering already falls back to the desktop image whenever a narrower
-- tier is empty (see components/home/DeviceImage.tsx), which is exactly
-- today's behaviour for every row that predates this column.
--
-- Kept as a shared column (like image_path/mobile_image_path) rather than
-- config jsonb, since it follows the exact same "every kind that has an
-- image gets this" pattern those two already established — see migration
-- 0004_homepage_sections.sql's own reasoning for mobile_image_path.
--
-- The Promotional Banner's second banner (Banner 2) is intentionally NOT a
-- set of columns here — it's specific to the "promo" kind only, so its
-- fields (including its own desktop/tablet/mobile images) live in the
-- existing config jsonb column instead, consistent with how product_rail's
-- source and trust's items already use config for kind-specific data.
ALTER TABLE shop.homepage_block
  ADD COLUMN IF NOT EXISTS tablet_image_path text;
