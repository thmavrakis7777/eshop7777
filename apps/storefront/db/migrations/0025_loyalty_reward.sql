-- Loyalty reward: a system-generated €5 coupon credited to a customer's
-- account after their first completed order with a >=€50 subtotal. Reuses
-- the existing discount/redemption system rather than a parallel one — a
-- loyalty coupon IS a shop.discount row, just owned by exactly one customer
-- and tied to the order that earned it, instead of being a public code an
-- admin created.

ALTER TABLE shop.discount
  ADD COLUMN IF NOT EXISTS owner_customer_id uuid REFERENCES shop.customer(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_order_id   uuid REFERENCES shop.orders(id)   ON DELETE SET NULL;

-- The idempotency guard for "one qualifying order = one coupon": the
-- database itself refuses a second coupon for the same order, on top of
-- completeOrder's own once-per-cart transaction guarantee (MIGRATION_PLAN.md
-- "Order completion is the one place 'roughly right' is not good enough").
CREATE UNIQUE INDEX IF NOT EXISTS discount_source_order_key
  ON shop.discount (source_order_id) WHERE source_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS discount_owner_idx
  ON shop.discount (owner_customer_id) WHERE owner_customer_id IS NOT NULL;

-- Admin-configurable so the owner can change the expiry window without a
-- code change, same pattern as free_shipping_threshold_cents on this same
-- singleton. NULL means "no expiry" (an explicit admin choice, not the
-- column's starting state — the singleton row is backfilled to 60 below so
-- the stored value matches the 60-day default completeOrder already falls
-- back to when this column is null on a fresh/missing row).
ALTER TABLE shop.site_setting
  ADD COLUMN IF NOT EXISTS loyalty_reward_expiry_days int;
UPDATE shop.site_setting SET loyalty_reward_expiry_days = 60 WHERE loyalty_reward_expiry_days IS NULL;
