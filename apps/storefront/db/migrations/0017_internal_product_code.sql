-- 0017_internal_product_code.sql
--
-- An internal, business-only product code (e.g. "MH-00125"), separate from
-- SKU: SKU lives per-variant and is customer-facing (shows on packing
-- slips, order emails, the storefront). This is a single per-product,
-- admin-only identifier for internal stock/ops tracking.
--
-- Partial unique index rather than a plain UNIQUE constraint: Postgres
-- already treats separate NULLs as distinct under a plain UNIQUE index too,
-- but the partial form (`WHERE internal_code IS NOT NULL`) makes the "not
-- enforced when empty" intent explicit, matching this schema's existing
-- style (see e.g. product_variant_sku_key). This is the real, DB-level
-- uniqueness backstop — the app also checks before writing, but a race
-- between two admins saving the same code at once is only actually
-- prevented here.

ALTER TABLE shop.product ADD COLUMN IF NOT EXISTS internal_code text;

CREATE UNIQUE INDEX IF NOT EXISTS product_internal_code_key
  ON shop.product (internal_code)
  WHERE internal_code IS NOT NULL;
