-- «Σειρά προϊόντων» (owner, 2026-10-15): a manual product order for each
-- category page, set in Admin → Κατηγορίες. A category page lists its own
-- products plus every subcategory's, so each category — parent or child —
-- keeps its own order: Κουζίνα and Τηγάνια can rank the same pan
-- differently.
--
-- A row exists only for a product the owner has placed on that category's
-- page. The storefront's default sort shows placed products first, by
-- position, then everything else in the existing order (newest first);
-- sold-out products still go last either way. No rows = today's order, so
-- this changes nothing until the owner saves an order.
--
-- A row whose product later moves to another category is left in place: the
-- listing only joins rows for products actually in that page's subtree, so
-- it is ignored, and it is used again if the product moves back.
CREATE TABLE IF NOT EXISTS shop.category_product_position (
  category_id uuid NOT NULL REFERENCES shop.category(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES shop.product(id) ON DELETE CASCADE,
  position    integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (category_id, product_id)
);

-- The primary key serves the listing's join (category_id, product_id); this
-- one serves the product-delete cascade.
CREATE INDEX IF NOT EXISTS category_product_position_product_idx
  ON shop.category_product_position (product_id);

-- Same lock-down as every other shop table (0001_init.sql): RLS on with zero
-- policies. Nothing reaches this table except the server's own connection.
ALTER TABLE shop.category_product_position ENABLE ROW LEVEL SECURITY;
