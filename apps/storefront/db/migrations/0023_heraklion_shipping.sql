-- A Heraklion-scoped shipping method is just another row in the existing
-- shop.shipping_method table, flagged with this column, rather than a
-- second shipping/config system. getShippingOptionsForCart filters on it
-- once the cart's delivery address is known to be Heraklion; every other
-- pricing rule (price_cents, free_over_cents, computeTotals) is reused
-- completely unchanged.
ALTER TABLE shop.shipping_method
  ADD COLUMN IF NOT EXISTS heraklion_only boolean NOT NULL DEFAULT false;

-- Seed the Heraklion method with the requested defaults (€30 free-shipping
-- threshold, €2.50 standard price) so the feature is live immediately after
-- migrating, without requiring a dashboard visit first. Guarded so re-running
-- the migration (or a store that already created this row by hand) never
-- creates a duplicate.
INSERT INTO shop.shipping_method (name, description, price_cents, free_over_cents, is_pickup, is_active, sort_order, heraklion_only)
SELECT 'Παράδοση Ηράκλειο', 'Παράδοση εντός Ηρακλείου Κρήτης', 250, 3000, false, true, 5, true
WHERE NOT EXISTS (SELECT 1 FROM shop.shipping_method WHERE heraklion_only);
