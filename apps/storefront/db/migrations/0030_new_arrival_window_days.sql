-- QA-012: the "Νέες αφίξεις" window (how many days a product counts as new)
-- was a hardcoded constant (NEW_ARRIVAL_WINDOW_DAYS in lib/db/catalog.ts).
-- Admin-configurable now, same pattern as loyalty_reward_expiry_days on this
-- same singleton (0025_loyalty_reward.sql) — except NULL has no meaningful
-- reading here (there is no "products are never new" state an admin would
-- want), so this stays NOT NULL with a default that preserves the exact
-- previous hardcoded behavior (30) for every existing row.
ALTER TABLE shop.site_setting
  ADD COLUMN IF NOT EXISTS new_arrival_window_days int NOT NULL DEFAULT 30;

-- Defense in depth alongside the action-level check in settings-actions.ts —
-- same reasoning as shipping_method_free_over_cents_nonneg (0024).
ALTER TABLE shop.site_setting
  ADD CONSTRAINT site_setting_new_arrival_window_days_positive
    CHECK (new_arrival_window_days > 0);
