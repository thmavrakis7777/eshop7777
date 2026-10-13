-- Sitemap <lastmod> for product pages (getAllProductSlugs in
-- lib/db/catalog.ts) reads shop.product.updated_at. The product_touch
-- trigger only moves that when the product row itself is written, so a
-- dashboard edit that only touched a variant or a photo left the page's
-- lastmod behind, even though the page changed: a new price or sale price,
-- a variant switched on or off, «Κατόπιν παραγγελίας» toggled
-- (allow_backorder), a new code (SKU, shown on the page and in the Product
-- JSON-LD), or a photo added, removed, reordered (the first one is the
-- JSON-LD image and the social preview) or given new alt text.
--
-- These triggers touch the parent product for exactly those changes. Stock
-- is deliberately not one of them: checkout and the stock screens write
-- only stock_quantity, an `UPDATE OF` trigger fires only when one of its
-- listed columns is in the statement's SET list, so a sale never runs this
-- and never locks a product row inside checkout. The page shows no stock
-- count, only in stock / on order / sold out, and a lastmod moved by every
-- sale would claim changes nobody can see.
--
-- category lastmod (getCategoryLastModified) reads the same updated_at, so
-- a price edit now also dates the category listing that shows the price.

CREATE OR REPLACE FUNCTION shop.touch_product_from_child() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parent uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    parent := OLD.product_id;
  ELSE
    parent := NEW.product_id;
  END IF;
  -- product_touch (BEFORE UPDATE) sets updated_at itself. When the product
  -- is being deleted (its variants and photos go by cascade) the row is
  -- already gone and this updates nothing.
  UPDATE shop.product SET updated_at = now() WHERE id = parent;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS product_variant_content_touch ON shop.product_variant;
CREATE TRIGGER product_variant_content_touch
  AFTER UPDATE OF price_cents, compare_at_price_cents, is_active, allow_backorder, sku, title
  ON shop.product_variant
  FOR EACH ROW
  WHEN ((OLD.price_cents, OLD.compare_at_price_cents, OLD.is_active, OLD.allow_backorder, OLD.sku, OLD.title)
        IS DISTINCT FROM
        (NEW.price_cents, NEW.compare_at_price_cents, NEW.is_active, NEW.allow_backorder, NEW.sku, NEW.title))
  EXECUTE FUNCTION shop.touch_product_from_child();

DROP TRIGGER IF EXISTS product_variant_added_removed_touch ON shop.product_variant;
CREATE TRIGGER product_variant_added_removed_touch
  AFTER INSERT OR DELETE ON shop.product_variant
  FOR EACH ROW EXECUTE FUNCTION shop.touch_product_from_child();

DROP TRIGGER IF EXISTS product_image_content_touch ON shop.product_image;
CREATE TRIGGER product_image_content_touch
  AFTER UPDATE OF storage_path, alt_text, position
  ON shop.product_image
  FOR EACH ROW
  WHEN ((OLD.storage_path, OLD.alt_text, OLD.position) IS DISTINCT FROM (NEW.storage_path, NEW.alt_text, NEW.position))
  EXECUTE FUNCTION shop.touch_product_from_child();

DROP TRIGGER IF EXISTS product_image_added_removed_touch ON shop.product_image;
CREATE TRIGGER product_image_added_removed_touch
  AFTER INSERT OR DELETE ON shop.product_image
  FOR EACH ROW EXECUTE FUNCTION shop.touch_product_from_child();
