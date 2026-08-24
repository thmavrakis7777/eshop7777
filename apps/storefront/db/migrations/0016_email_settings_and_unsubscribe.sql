-- 0016_email_settings_and_unsubscribe.sql
--
-- Three additions, all requested together:
--
-- 1. Newsletter unsubscribe token. One-click, no login — the token IS the
--    auth (same trust model as the guest-order uuid already used elsewhere
--    in this schema: unguessable at 192 bits, scoped to exactly one row).
--    DEFAULT means every future INSERT gets one automatically with no app
--    code path to remember; existing rows are backfilled below.
--
-- 2. Owner-facing email settings on the existing site_setting singleton —
--    not a new settings table, this is one more admin-editable row on the
--    same one every other storefront setting already lives on.
--    owner_notification_email: where "you have a new order" goes (falls
--    back to contact_email in code if unset, so this is optional, not a
--    second required field).
--    newsletter_notification_email: where "someone subscribed" goes.
--    newsletter_from_email: optional override sender for just the
--    newsletter confirmation, if the owner wants it to read differently
--    from RESEND_FROM_EMAIL. Unset = falls back to the shared sender.
--    newsletter_subject/heading/body/button_text/button_url/footer: the
--    owner-editable copy for the newsletter confirmation email. Structured
--    fields, not a raw-HTML box — there is no legitimate reason a
--    newsletter confirmation needs arbitrary markup, and a raw editor here
--    would be a real stored-XSS surface for zero benefit.

ALTER TABLE shop.newsletter_subscriber
  ADD COLUMN IF NOT EXISTS unsubscribe_token text DEFAULT encode(gen_random_bytes(24), 'hex');

UPDATE shop.newsletter_subscriber
   SET unsubscribe_token = encode(gen_random_bytes(24), 'hex')
 WHERE unsubscribe_token IS NULL;

ALTER TABLE shop.newsletter_subscriber
  ALTER COLUMN unsubscribe_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscriber_unsubscribe_token_key
  ON shop.newsletter_subscriber (unsubscribe_token);

ALTER TABLE shop.site_setting
  ADD COLUMN IF NOT EXISTS owner_notification_email      text,
  ADD COLUMN IF NOT EXISTS newsletter_notification_email  text,
  ADD COLUMN IF NOT EXISTS newsletter_from_email          text,
  ADD COLUMN IF NOT EXISTS newsletter_subject             text,
  ADD COLUMN IF NOT EXISTS newsletter_heading              text,
  ADD COLUMN IF NOT EXISTS newsletter_body                text,
  ADD COLUMN IF NOT EXISTS newsletter_button_text          text,
  ADD COLUMN IF NOT EXISTS newsletter_button_url           text,
  ADD COLUMN IF NOT EXISTS newsletter_footer               text;
