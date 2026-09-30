-- 0034_customer_identity.sql
--
-- "Συνέχεια με Google" (CHECKOUT_PREFILL_GOOGLE_SPEC.md §3). One row per
-- external sign-in linked to a customer — the Google account's stable ID
-- (the ID token's `sub`), never its email, is what a returning Google
-- sign-in is matched on: a Google email can change, `sub` cannot.
--
-- Its own table rather than a google_sub column on shop.customer, so a
-- customer can have more than one linked sign-in and a later provider needs
-- no change to the customer row. The (provider, subject) primary key makes a
-- Google account linkable to exactly one customer.
--
-- Additive only: no existing table changes. A customer who links Google
-- keeps their password (owner's decision D1); an account created by Google
-- sign-in has password_hash NULL, and lib/db/customer.ts's registerCustomer
-- refuses to take such a row over.
CREATE TABLE IF NOT EXISTS shop.customer_identity (
  provider       text NOT NULL CHECK (provider IN ('google')),
  subject        text NOT NULL,
  customer_id    uuid NOT NULL REFERENCES shop.customer(id) ON DELETE CASCADE,
  -- The Google email at the moment of linking — for support ("which Google
  -- account is this?"), never used for matching.
  email_at_link  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS customer_identity_customer_idx ON shop.customer_identity (customer_id);

-- Same lock-down as every other shop table (0001_init.sql): RLS on with zero
-- policies. Nothing reaches this table except the server's own connection.
ALTER TABLE shop.customer_identity ENABLE ROW LEVEL SECURITY;
