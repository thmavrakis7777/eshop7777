-- 0008_product_shipping.sql
--
-- Per-product shipping for heavy/oversized items.
--
-- The existing shop.shipping_method table stays exactly as it is: it is the
-- STANDARD cost, chosen at checkout, and most products keep using it. This
-- adds an optional per-product override for the minority that genuinely cost
-- more to send.
--
-- Cart rule (implemented in computeTotals, lib/db/cart.ts):
--   * every oversized line charges its own cost, multiplied by quantity —
--     two bathtubs need two parcels
--   * standard items ride along free whenever any oversized item is present
--   * the chosen shipping_method price applies ONLY when the cart is
--     entirely standard
--
-- So: 1 normal = 3.50; 1 heavy + 1 normal = 8.00; 2 heavy + 1 normal = 16.00.
-- That last case is why this is not "highest item wins".
--
-- shipping_class is descriptive; shipping_cost_cents is what actually gets
-- charged. Keeping both means the admin can group products ("all our heavy
-- items") without the label silently determining money — an operator who
-- sets class='heavy' and leaves the cost NULL gets standard shipping, not a
-- guessed surcharge.

ALTER TABLE shop.product
  ADD COLUMN IF NOT EXISTS shipping_class text NOT NULL DEFAULT 'standard'
    CHECK (shipping_class IN ('standard', 'heavy', 'large', 'custom')),
  ADD COLUMN IF NOT EXISTS shipping_cost_cents int
    CHECK (shipping_cost_cents IS NULL OR shipping_cost_cents >= 0);

-- Partial index: the cart only ever asks "does this cart contain anything
-- with its own shipping cost?", and that is a small minority of rows.
CREATE INDEX IF NOT EXISTS product_shipping_cost_idx
  ON shop.product (id) WHERE shipping_cost_cents IS NOT NULL;
