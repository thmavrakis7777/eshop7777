-- A cart line no longer blocks deleting its product (bug found 2026-10-05:
-- the owner could not delete the 12 test products from the admin).
--
-- 0001 made cart_item.variant_id ON DELETE RESTRICT. Carts outlive visits —
-- abandoned and test carts stay in the table — so any product that had ever
-- been put in a cart and not removed could not be deleted: the single and
-- bulk delete (and deleting one variant) failed with a foreign-key error,
-- and the bulk delete, being one transaction, then deleted nothing at all.
-- 11 of the 12 test products were in carts (one of them in 24).
--
-- CASCADE instead: a product that no longer exists cannot be bought, so its
-- line simply leaves every cart. The cart is re-read and its totals
-- recomputed from the remaining lines on the next load (lib/db/cart.ts), and
-- checkout re-reads the cart too. Orders are unaffected — order_item keeps
-- its own snapshot and only loses the link (ON DELETE SET NULL, 0001).
ALTER TABLE shop.cart_item
  DROP CONSTRAINT cart_item_variant_id_fkey;
ALTER TABLE shop.cart_item
  ADD CONSTRAINT cart_item_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES shop.product_variant(id) ON DELETE CASCADE;
