# €5 Loyalty Reward — Proposed Architecture (spec, not built)

Written 2026-08-30. Same pattern as every other non-trivial feature here:
inspect current implementation, propose, get sign-off, then build.

## Current state (confirmed by inspection)

- **Discounts already exist as one system** (`shop.discount` +
  `shop.discount_redemption`) — code, percentage/fixed value, optional
  minimum subtotal, optional window, optional redemption cap, derived
  `state`. Applied to a cart (`applyDiscount(cartId, code)` in
  `lib/db/cart.ts`), re-validated and locked `FOR UPDATE` inside
  `completeOrder`'s transaction (`lib/db/checkout.ts`), which is the single
  atomic place order creation, stock decrement, and discount redemption all
  happen together.
- **`completeOrder` already guarantees "exactly once per order"** — the cart
  is locked `FOR UPDATE` and checked for `status = 'completed'` before
  anything is written, so a double-click or a retried call for the same cart
  produces one order, never two. Anything I add inside that same transaction
  inherits that guarantee for free — no separate idempotency key needed.
- **No customer row is created for guest orders today** — grepped for every
  `INSERT INTO shop.customer`; the only one is in `registerCustomer`
  (`lib/db/customer.ts`). A guest checkout's `orders.customer_id` is `NULL`.
  "Logged in" is unambiguous: `getCustomerId()` (session cookie) resolves to
  a real `shop.customer.id` or `null`.
- **No "create account during checkout" flow exists.** Checkout is 100%
  guest-or-already-logged-in today; the only account prompt is a link to
  `/logariasmos` on the *post-order* confirmation page. This needs building
  (small — `registerCustomer` already does everything needed
  transactionally, including "upgrade an email that ordered as guest
  before").
- Money is integer cents, VAT-inclusive. "Cart subtotal" in this codebase
  means `subtotal_cents` — pre-discount, pre-shipping (the "Υποσύνολο" line
  shown everywhere, including the order-confirmation page).

## Proposed architecture

**1. Migration** — two nullable columns on `shop.discount`, no new table
(reuses the existing discount/redemption system exactly as instructed):
```sql
ALTER TABLE shop.discount
  ADD COLUMN owner_customer_id uuid REFERENCES shop.customer(id) ON DELETE SET NULL,
  ADD COLUMN source_order_id   uuid REFERENCES shop.orders(id)   ON DELETE SET NULL;
CREATE UNIQUE INDEX discount_source_order_key
  ON shop.discount (source_order_id) WHERE source_order_id IS NOT NULL;
```
`owner_customer_id` is `NULL` for every existing/admin-created public code
(unchanged behavior) and set only for a system-generated loyalty coupon.
`source_order_id`'s uniqueness is the actual idempotency guard — the
database itself refuses a second coupon for the same qualifying order, on
top of `completeOrder`'s existing once-only guarantee.

**2. Coupon issuance — inside `completeOrder`'s existing transaction**, right
after the order and its items are inserted, before the cart is marked
`completed`:
```
rewardCustomerId = customerId ?? cart.customer_id
if (rewardCustomerId && totals.subtotalCents >= 5000):
    generate a unique code (e.g. LOYAL-XXXXXX, retried against the existing
    unique code index)
    INSERT INTO shop.discount (code, type='fixed', value=500,
      min_subtotal_cents=0, max_redemptions=1, is_active=true,
      owner_customer_id=rewardCustomerId, source_order_id=order.id,
      description='Ανταμοιβή πιστότητας — παραγγελία #<order_number>')
```
Same transaction as stock decrement and order-row insert → if anything
later in `completeOrder` fails, the coupon never persists either (matches
"only after the order is successfully completed").

**3. Ownership enforcement** — `applyDiscount(cartId, code)` gets a
`customerId` parameter (same pattern `completeOrder` already uses). If the
matched row has `owner_customer_id` set and it doesn't match the caller's
session, treat the code as unknown (generic "invalid code" — never confirms
a private code exists, so it can't be enumerated).

**4. Account creation during checkout** — smallest integration on top of
what exists: a password field appears in `CheckoutForm` only when (a) the
shopper is a guest and (b) cart subtotal ≥ €50, next to the qualification
message. On order placement, if filled, `registerCustomer` runs first
(reusing the existing transactional register, including its guest-upgrade
path), the session cookie is set, and that new `customerId` is what
`completeOrder` receives — same call, no new order-completion path.

**5. Surfacing the reward** — the order-confirmation page
(`/checkout/epibebaiosi`) looks up `shop.discount WHERE source_order_id =
order.id` (read-only, no new state to thread through) and shows the code if
one was issued. I'd also add a short "Τα κουπόνια μου" list to
`/logariasmos` (customer dashboard) — otherwise a customer has no way to
ever find the code again after leaving that one page. And a one-line note
in `listDiscounts` (admin) showing the owning customer's email next to any
loyalty coupon, so it doesn't look like an unexplained code to an admin.

**6. All copy in Greek**, matching the site's existing convention (every
checkout/account string in this codebase is Greek, no exceptions) —
translating your English copy rather than using it verbatim, e.g.:
- Qualified, logged in: *"Πληρείς τις προϋποθέσεις! Ένα μοναδικό κουπόνι
  έκπτωσης 5€ θα πιστωθεί στον λογαριασμό σου μόλις ολοκληρωθεί η
  παραγγελία."*
- Qualified, guest: *"Δημιούργησε λογαριασμό κατά την ολοκλήρωση της
  παραγγελίας για να ξεκλειδώσεις ένα κουπόνι έκπτωσης 5€ για την επόμενη
  παραγγελία σου!"*

## Open decisions (need your call before I write code)

1. **Coupon expiry** — your spec doesn't say. Default I'd use: no expiry
   (`ends_at = NULL`), single-use (`max_redemptions = 1`). Fine, or should
   it expire after some period (e.g. 90 days)?
2. **Guest tries to create an account with an email that already has a
   password-protected account** (mistyped, forgot they have one) —
   `registerCustomer` already rejects this (`email_taken`). Should checkout
   then (a) fail with "an account already exists, please log in first" and
   not place the order, or (b) silently place the order as guest with no
   reward? I'd default to (a) — less surprising, and they haven't lost
   anything (cart is untouched, they can log in and retry).
3. Anything else this reward should touch that I haven't inspected — e.g.
   should the order-confirmation **email** also mention the coupon code, or
   is on-page + dashboard enough for v1?

Once you confirm these (or tell me to just use my defaults), I'll build it,
verify live against the real dev database the same way every prior feature
here was verified, and stop for a commit/push decision same as always.
