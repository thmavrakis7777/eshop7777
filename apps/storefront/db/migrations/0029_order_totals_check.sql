-- The order-total arithmetic (subtotal - discount + shipping = total, see the
-- comment on shop.orders in 0001_init.sql) and every individual cents column
-- have so far been enforced only by application code (computeTotals /
-- completeOrder). Unlike shipping_method.free_over_cents (0024) and
-- product_variant.stock_quantity (0026), nothing at the DB layer would catch
-- a bad row here. Zero live orders violate either check as of this writing.
ALTER TABLE shop.orders
  ADD CONSTRAINT orders_totals_arithmetic
    CHECK (total_cents = subtotal_cents - discount_cents + shipping_cents),
  ADD CONSTRAINT orders_cents_nonneg
    CHECK (subtotal_cents >= 0 AND discount_cents >= 0 AND shipping_cents >= 0
           AND vat_cents >= 0 AND total_cents >= 0);
