-- The store sells only stock that is on the shelf — no backorders.
--
-- 1) Drop product.backorder_delivery_text, added in 0032 for a backorder
--    delivery time that is no longer wanted. Verified empty on every product
--    before this ran (the column existed for minutes and no code ever wrote
--    it), so no data is lost.
ALTER TABLE shop.product
  DROP COLUMN IF EXISTS backorder_delivery_text;

-- 2) Enforce "no backorders" in the database, not only in the admin form
--    (saveVariantAction forces allow_backorder = false). Every existing
--    variant already has it false, so this cannot fail on current data. With
--    it false everywhere, the existing stock rule used by cart and checkout
--    (`allow_backorder OR stock_quantity >= quantity`) reduces to "only what
--    is in stock" without touching that logic.
ALTER TABLE shop.product_variant
  ADD CONSTRAINT product_variant_no_backorder CHECK (NOT allow_backorder);

-- 3) shop.stock_notification_request (0032) is unchanged in shape. Its rows
--    are now deleted as soon as the notification email is sent
--    (lib/stock-notifications.ts): the address is used for that one
--    notification only and not kept afterwards. notified_at remains as the
--    in-flight marker while a send is in progress.
