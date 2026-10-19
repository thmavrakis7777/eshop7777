-- Products that a courier won't carry (owner, 2026-10-19): gas cartridges
-- (Φιαλίδια Υγραερίου) can't be sent by ACS, Γενική Ταχυδρομική or Courier
-- Center. They can still be collected from the shop or brought by the
-- shop's own Heraklion delivery (the heraklion_only method, with its usual
-- price and free-over threshold).
--
-- Set per category, not per product, so a new cartridge added to that
-- category is covered without anyone having to remember a second tick.
-- A cart holding any such product loses every courier method — the whole
-- order, not just that line: one order travels one way. "Courier" means a
-- shipping_method that is neither is_pickup nor heraklion_only; the rule
-- lives in getShippingOptionsForCart, setShippingMethod and completeOrder.
ALTER TABLE shop.category
  ADD COLUMN IF NOT EXISTS no_courier boolean NOT NULL DEFAULT false;

UPDATE shop.category SET no_courier = true WHERE slug = 'fialidia-ygraeriou';
