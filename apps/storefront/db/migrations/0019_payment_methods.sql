-- 0019_payment_methods.sql
--
-- Payment method was a UI-level hardcode ({id:"cod"}, a local label map in
-- PaymentSection.tsx, the literal 'cod' written on every order) — no table
-- backed it. Mirrors shop.shipping_method's shape/pattern exactly: a short
-- admin-editable list with enable/disable + display name + description +
-- ordering.
--
-- `code` (not `id`) is the stable identity the application code branches
-- on — only 'cod' and 'bank_transfer' are real, implementable flows today
-- (both just create an unpaid order the owner reconciles manually; neither
-- needs a payment gateway). Card payment has no processor integration
-- anywhere in this codebase and deliberately gets no row here — the admin
-- UI shows it as a fixed "not configured" line instead of a toggle, so the
-- dashboard can never make an unimplemented method appear at checkout.
CREATE TABLE IF NOT EXISTS shop.payment_method (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE CHECK (code IN ('cod', 'bank_transfer')),
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0
);

INSERT INTO shop.payment_method (code, name, description, is_active, sort_order) VALUES
  ('cod', 'Αντικαταβολή', 'Πληρωμή κατά την παράδοση', true, 0),
  ('bank_transfer', 'Τραπεζική κατάθεση', '', false, 1)
ON CONFLICT (code) DO NOTHING;

-- shop.orders.payment_method already exists (`text NOT NULL DEFAULT 'cod'`,
-- 0001_init.sql) and was always written as the literal 'cod' at checkout;
-- it now gets the customer's real selected method code instead. Existing
-- orders keep their true value (they were all COD, the only real flow
-- before this migration) — nothing to backfill.
