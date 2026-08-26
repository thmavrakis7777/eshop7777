-- 0018_pdp_content_blocks.sql
--
-- The PDP's delivery/returns/payment line ("Παράδοση: 2-3 εργάσιμες...")
-- was hardcoded JSX text with no way for the owner to change it without a
-- code change. Two levels, both optional:
--
-- 1. Global defaults on the existing site_setting singleton — same pattern
--    as every other owner-editable storefront string (see 0016). Real
--    starting values, not NULL, so existing behavior is unchanged the
--    moment this migration runs; the owner edits from there.
-- 2. Per-product override on shop.product, nullable/no default. NULL or ''
--    both mean "use the global default" — this schema's established
--    "empty string is unset" convention (see MIGRATION_PLAN.md), resolved
--    with `||` at the read site, not `??`.

ALTER TABLE shop.site_setting
  ADD COLUMN IF NOT EXISTS pdp_delivery_text text NOT NULL DEFAULT '2-3 εργάσιμες σε όλη την Ελλάδα',
  ADD COLUMN IF NOT EXISTS pdp_returns_text  text NOT NULL DEFAULT 'Δωρεάν εντός 30 ημερών',
  ADD COLUMN IF NOT EXISTS pdp_payment_text  text NOT NULL DEFAULT 'Αντικαταβολή κατά την παράδοση';

ALTER TABLE shop.product
  ADD COLUMN IF NOT EXISTS delivery_text_override text,
  ADD COLUMN IF NOT EXISTS returns_text_override  text,
  ADD COLUMN IF NOT EXISTS payment_text_override  text;
