-- 0014_newsletter.sql
--
-- Newsletter signup (QA-005): Newsletter.tsx's form has always been a no-op
-- (onSubmit: e.preventDefault(), nothing else). SendGrid Marketing Contacts
-- was evaluated first, per project policy against adding a new paid
-- provider without proof it's needed — its free plan was retired
-- industry-wide 2025-05-27, replaced only by a one-time 60-day/100-contact
-- trial and then a paid plan, not a durable €0/month fit. So this stores
-- subscribers in the same Supabase database as everything else instead, at
-- no additional cost — exportable later to a real ESP once the business is
-- ready to pay for one.
--
-- Deliberately a new table rather than reusing shop.customer.
-- marketing_consent: that column is account-scoped and write-once-to-false
-- (withdrawal only, see withdrawConsentAction in lib/actions/customer.ts) —
-- an anonymous visitor signing up here has no customer row at all, and most
-- never will.

CREATE TABLE IF NOT EXISTS shop.newsletter_subscriber (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL,
  is_active        boolean NOT NULL DEFAULT true,
  subscribed_at    timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at  timestamptz
);

-- Case-insensitive uniqueness: "Foo@x.com" and "foo@x.com" are one
-- subscriber, matching how shop.customer already treats email.
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscriber_email_key
  ON shop.newsletter_subscriber (lower(email));
