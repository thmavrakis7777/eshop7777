-- «Κατόπιν παραγγελίας» (owner, 2026-10-03): products the owner picks can be
-- ordered once their shelf stock reaches 0; the shop then orders them from
-- the supplier and tells the customer the delivery time. While there is
-- stock, the limit is the stock, exactly as before.
--
-- 1) Lift 0033's blanket ban. allow_backorder is the owner's per-variant
--    choice again (the product editor's «Κατόπιν παραγγελίας» checkbox).
--    Its meaning is now narrower than "unlimited": it applies only at stock
--    0 (lib/stock.ts isQuantityAvailable). Every variant is false today, so
--    nothing changes until the owner ticks a product.
ALTER TABLE shop.product_variant
  DROP CONSTRAINT IF EXISTS product_variant_no_backorder;

-- 2) How many units of an order line had to be ordered from the supplier,
--    fixed at checkout. Stock never goes below 0 (0026), so without this an
--    order could not say which units came off the shelf: the admin order
--    page flags these units, the emails tell the customer, and cancelling
--    returns only the shelf units to stock. 0 for every existing line, which
--    is true — none was ever on order.
ALTER TABLE shop.order_item
  ADD COLUMN IF NOT EXISTS backordered_quantity int NOT NULL DEFAULT 0;
ALTER TABLE shop.order_item
  ADD CONSTRAINT order_item_backordered_quantity_range
  CHECK (backordered_quantity >= 0 AND backordered_quantity <= quantity);
