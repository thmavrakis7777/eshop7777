-- 0015_shipment_tracking.sql
--
-- Admin-entered courier/tracking info, plus per-order email-send bookkeeping
-- so the dashboard can show "Email confirmation: Sent 22/08 14:35" and the
-- automatic shipment-notification trigger can tell "never sent yet" from
-- "already sent, don't send again" without a separate table.
--
-- courier_name/tracking_code/tracking_url are plain nullable text, not a
-- courier lookup table: the courier list this store actually uses is small
-- and admin-typed (see COURIER_SUGGESTIONS in ShipmentControls.tsx), and a
-- manual tracking_url exists because no verified official deep-link tracking
-- URL format was confirmed for any Greek courier — guessing one was
-- explicitly out of scope.
--
-- confirmation_email_sent_at / shipment_email_sent_at are the duplicate-send
-- guard: the automatic shipment-email trigger fires only while
-- shipment_email_sent_at IS NULL. Once set — by the automatic send or a
-- manual resend — saving courier/tracking again (same values or changed)
-- never auto-sends again; only the admin's explicit "Resend" action can.

ALTER TABLE shop.orders
  ADD COLUMN IF NOT EXISTS courier_name              text,
  ADD COLUMN IF NOT EXISTS tracking_code              text,
  ADD COLUMN IF NOT EXISTS tracking_url               text,
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipment_email_sent_at     timestamptz;
