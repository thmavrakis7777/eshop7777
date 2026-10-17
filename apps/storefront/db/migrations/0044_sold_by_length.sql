-- Sold by length (owner, 2026-10-17 — LENGTH_SALES_SPEC.md): the gas hose
-- (00046) is sold by the metre, 1 μ to 20 μ in 0,5 μ steps, 3,00 € per metre.
--
-- The shop's quantities stay whole numbers: a length product is counted in
-- steps (length_step_cm), so 2,5 μ is a cart/order/stock quantity of 5 and
-- every money and stock path keeps its integer maths. The variant's
-- price_cents stays the price per METRE; lib/length.ts stepPriceCents gives
-- the price of one step where money is fixed (cart add, checkout).
--
-- length_step_cm NULL = sold by the piece, exactly as before. min/max are
-- per order line (max 20 μ is the owner's limit per customer, not the stock).
ALTER TABLE shop.product
  ADD COLUMN IF NOT EXISTS length_step_cm int CHECK (length_step_cm IS NULL OR length_step_cm > 0),
  ADD COLUMN IF NOT EXISTS length_min_cm int,
  ADD COLUMN IF NOT EXISTS length_max_cm int;

ALTER TABLE shop.product
  ADD CONSTRAINT product_length_rule CHECK (
    length_step_cm IS NULL
    OR (length_min_cm IS NOT NULL AND length_max_cm IS NOT NULL
        AND length_min_cm >= length_step_cm AND length_max_cm >= length_min_cm
        AND length_min_cm % length_step_cm = 0 AND length_max_cm % length_step_cm = 0)
  );

-- Copied at order time, so a past order still reads «2,5 μ» (not «5») even if
-- the product's step changes or the product is deleted later.
ALTER TABLE shop.order_item
  ADD COLUMN IF NOT EXISTS length_step_cm int;
