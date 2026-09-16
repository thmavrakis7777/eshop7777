-- Backorder messaging + "notify me when available".
--
-- 1) Per-product delivery time for backordered units («Κατόπιν
--    παραγγελίας»). Its own column rather than a reuse of
--    delivery_text_override: that one is the product page's general
--    «Παράδοση» line, true for units already on the shelf, while this one
--    only ever describes units that must be ordered from the supplier first.
--    Nullable with no default — NULL means the storefront's shipped default
--    («Αποστολή σε 7–15 εργάσιμες», DEFAULT_BACKORDER_DELIVERY_TEXT in
--    lib/stock.ts), same "empty means use the default" convention as the
--    other product text overrides.
ALTER TABLE shop.product
  ADD COLUMN IF NOT EXISTS backorder_delivery_text text;

-- 2) «Ενημέρωσέ με όταν παραληφθεί» requests for sold-out variants. Per
--    variant, not per product: stock is per variant, so "back in stock" is
--    too. notified_at is set when the email goes out; the row is kept as a
--    record of the send rather than deleted.
CREATE TABLE IF NOT EXISTS shop.stock_notification_request (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id   uuid NOT NULL REFERENCES shop.product_variant(id) ON DELETE CASCADE,
  email        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  notified_at  timestamptz
);

-- One pending request per email per variant, case-insensitive (same
-- lower(email) rule as newsletter_subscriber): submitting twice while still
-- waiting is a no-op, while asking again after a previous notification was
-- sent (notified_at set) is a fresh request.
CREATE UNIQUE INDEX IF NOT EXISTS stock_notification_request_pending_key
  ON shop.stock_notification_request (variant_id, lower(email))
  WHERE notified_at IS NULL;
