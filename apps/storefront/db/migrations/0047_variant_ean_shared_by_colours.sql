-- The same EAN may appear on more than one variant (owner, 2026-11-05), so
-- 0046's "unique when set" index goes:
-- - the owner's suppliers print one barcode for every colour of a product;
-- - the owner sometimes lists each colour as its own product, with that same
--   barcode on both.
-- The admin save still says where else a code is already used (a match may
-- be a typo), but saves it either way — otherProductsWithEan in
-- lib/admin/products.ts.
DROP INDEX IF EXISTS shop.product_variant_ean_key;
