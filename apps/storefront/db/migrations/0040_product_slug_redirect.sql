-- A product's old URL keeps working after its slug is changed in the
-- dashboard. Before this, /proionta/<old-slug> became a 404 the moment the
-- slug was saved: whatever Google had indexed and every link shared on
-- Facebook or WhatsApp broke, and the page's standing in search started
-- over at the new address.
--
-- Every slug a product has given up is remembered here, pointing at the
-- product (not at its next slug), so a product renamed twice still sends
-- both old URLs straight to the current one, without a chain of hops. The
-- product layout (app/(storefront)/proionta/[handle]/layout.tsx) answers
-- a request for a slug no active product has with a permanent (308)
-- redirect when the slug is listed here and its product is active, and 404
-- otherwise. Deleting the product deletes its rows.
--
-- Kept by a trigger rather than the save action, so every way a slug can
-- change (product form, AI SEO tool, a script) is covered the same way. A
-- slug that is in use again, by this product taken back or by a new one,
-- stops redirecting at once: the live page always wins.

CREATE TABLE IF NOT EXISTS shop.product_slug_redirect (
  old_slug   text PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES shop.product(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- For the ON DELETE CASCADE lookup when a product is deleted.
CREATE INDEX IF NOT EXISTS product_slug_redirect_product_id_idx
  ON shop.product_slug_redirect (product_id);

CREATE OR REPLACE FUNCTION shop.remember_product_slug() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO shop.product_slug_redirect (old_slug, product_id)
    VALUES (OLD.slug, NEW.id)
    ON CONFLICT (old_slug) DO UPDATE SET product_id = EXCLUDED.product_id, created_at = now();
  END IF;
  DELETE FROM shop.product_slug_redirect WHERE old_slug = NEW.slug;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS product_slug_remember ON shop.product;
CREATE TRIGGER product_slug_remember
  AFTER UPDATE OF slug ON shop.product
  FOR EACH ROW
  WHEN (OLD.slug IS DISTINCT FROM NEW.slug)
  EXECUTE FUNCTION shop.remember_product_slug();

DROP TRIGGER IF EXISTS product_slug_claim ON shop.product;
CREATE TRIGGER product_slug_claim
  AFTER INSERT ON shop.product
  FOR EACH ROW
  EXECUTE FUNCTION shop.remember_product_slug();
