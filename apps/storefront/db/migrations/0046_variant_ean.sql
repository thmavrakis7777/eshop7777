-- EAN barcode per variant (owner, 2026-11-05): the number printed under the
-- barcode on the box. Empty for every product today; the owner fills it in
-- over time, and the product page shows it only once it is set.
--
-- On the variant, not the product: each colour of a stove is its own box with
-- its own barcode, exactly like its own SKU.
--
-- Any GTIN length, not just EAN-13: EAN-8 (8), UPC-A (12), EAN-13 (13) and
-- GTIN-14 (14) are the same family and all go into schema.org `gtin`. Digits
-- only here; the admin form also checks the last (check) digit, which catches
-- a mistyped number before it is saved.
--
-- Unique when set: two products with the same barcode is always a typo or a
-- copy-paste, never real.
ALTER TABLE shop.product_variant
  ADD COLUMN IF NOT EXISTS ean text
    CHECK (ean IS NULL OR ean ~ '^([0-9]{8}|[0-9]{12,14})$');

CREATE UNIQUE INDEX IF NOT EXISTS product_variant_ean_key
  ON shop.product_variant (ean) WHERE ean IS NOT NULL;
