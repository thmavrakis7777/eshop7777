-- «Best sellers» (owner, 2026-10-15): the products the owner ticks in the
-- product editor. They fill the /best-sellers page and the homepage's
-- Best Sellers rail and showcase source. It replaces «Προτεινόμενα»
-- (/protainomena), which had no flag at all and listed every active
-- product, so each new product showed up there by itself.
--
-- false for every existing product: nothing is listed until the owner
-- ticks a product. The partial index covers the listing query, which only
-- ever reads the ticked, active rows.
ALTER TABLE shop.product
  ADD COLUMN IF NOT EXISTS is_best_seller boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS product_best_seller_idx
  ON shop.product (id) WHERE is_best_seller AND is_active;
