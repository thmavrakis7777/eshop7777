-- price_cents already rejects negative values (0001_init.sql); free_over_cents
-- had no such guard, so a negative "free over" threshold could previously be
-- saved and would make every order in that bracket incorrectly free.
-- Defense in depth alongside the action-level check in settings-actions.ts.
ALTER TABLE shop.shipping_method
  ADD CONSTRAINT shipping_method_free_over_cents_nonneg
    CHECK (free_over_cents IS NULL OR free_over_cents >= 0);
