-- product_variant.price_cents and compare_at_price_cents already reject
-- negative values (0001_init.sql); stock_quantity had no such guard, so a
-- negative stock could previously be saved through the variant editor
-- (saveVariantAction parsed "Number(formData.get('stock')) || 0" with no
-- lower bound) and would corrupt total_stock sums, the low-stock filter,
-- and storefront availability logic that assumes non-negative stock.
-- Same bug class as shipping_method.free_over_cents, fixed the same way in
-- 0024_shipping_free_over_nonneg.sql — defense in depth alongside the
-- action-level check added in catalog-actions.ts.
ALTER TABLE shop.product_variant
  ADD CONSTRAINT product_variant_stock_quantity_nonneg
    CHECK (stock_quantity >= 0);
