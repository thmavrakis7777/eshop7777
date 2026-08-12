# Account System — Proposed Architecture (spec, not built)

Written 2026-08-12. No code from this doc has been written yet — same
pattern as `CART_UX_SPEC.md`/`CHECKOUT_UX_SPEC.md`: propose, get sign-off,
then build. `/logariasmos` currently 404s; the header/mobile-menu account
icons already link there.

## Current state (confirmed by inspection, not assumption)

- **No customer auth exists anywhere in this codebase** — no login form, no
  session handling, no password reset, nothing. Checkout is 100% guest
  (confirmed in `CHECKOUT_UX_SPEC.md`/`PROJECT_MEMORY.md`).
- Medusa's `customer` and `customer_address` tables already exist in the
  database (confirmed live via this session's RLS audit) — they're part of
  Medusa's core schema, just unused by any storefront flow today. No new
  tables needed for a basic account system.
- Medusa v2 ships a built-in customer auth provider (`emailpass`) on the
  Store API: registration, login, logout, and password reset are framework
  features, not something to build from scratch. This spec proposes using
  that, not a custom auth system.
- Wishlist (`localStorage`) and recently-viewed (`localStorage`) already
  exist as real features, explicitly built without accounts because none
  existed. A real account system reopens the question of whether these
  should sync server-side for a logged-in customer — flagged as an open
  decision below, not assumed.

## Proposed scope for v1

**In scope:**
1. Register (email + password), login, logout.
2. `/logariasmos` — a real account dashboard: order history (Medusa's
   `/store/customers/me/orders`), saved addresses (create/edit/delete via
   the existing `customer_address` model), basic profile (name/email/phone).
3. Password reset (Medusa's built-in reset-token flow + a real email via
   the SendGrid integration already wired for order confirmations).
4. Checkout stays guest-first — logging in becomes optional, not required,
   consistent with `CHECKOUT_UX_SPEC.md`'s explicit design goal of a low-
   friction guest flow. A logged-in customer's checkout can pre-fill saved
   address/contact info; that's the only checkout-side change.

**Explicitly not in v1** (flag if any of these turn out to matter more than
assumed):
- Social login (Google/Facebook) — no requirement seen anywhere in project
  docs.
- Saved payment methods — moot until a real card processor exists (Stripe,
  still on hold per `TASKS.md`).
- Server-side wishlist/recently-viewed sync for logged-in customers — real
  feature, but a distinct follow-up, not bundled into the first cut.

## Proposed technical approach

- **Session**: Medusa's auth endpoints return a JWT; store it in an
  `httpOnly`, `secure`, `sameSite=lax` cookie set by a Server Action (same
  pattern already used for the cart's `cart_id` cookie) — never expose the
  token to client JS.
- **Routes**: `/logariasmos` (dashboard, redirects to `/logariasmos/eisodos`
  if not logged in), `/logariasmos/eisodos` (login), `/logariasmos/eggrafi`
  (register), `/logariasmos/parangelies` (order history),
  `/logariasmos/diefthinseis` (addresses). Mirrors the existing route-per-
  concern pattern (`/kalathi`, `/checkout`, `/checkout/epibebaiosi`), not a
  single mega-page.
- **Data layer**: new `lib/data/customer.ts` (parallel to
  `lib/data/cart.ts`/`checkout.ts`) + `lib/actions/customer.ts` for the
  Server Actions (register/login/logout/update-address), same architecture
  already established for cart/checkout — no new pattern introduced.
- **Guest → customer cart**: Medusa supports associating an existing guest
  cart with a customer on login (`customer_id` transfer) — the cart the
  visitor was already building should carry over on login rather than
  resetting, same expectation as any real store.

## Open decisions (need your call before I write the implementation spec doc)

1. **Email verification required before checkout**, or optional (verify
   later, shop immediately)? Affects registration flow complexity and
   whether SendGrid's verification-email path needs building alongside
   password reset.
2. **Merge guest wishlist into the account on first login**, or keep
   wishlist `localStorage`-only regardless of login state (simpler, but
   means wishlist doesn't follow the customer across devices)?
3. Any specific fields beyond name/email/phone/address wanted on the
   profile (e.g. birthday for a future loyalty program) — asking now since
   the `customer` model would need a decision either way, not because one
   is expected.

## Why this is a spec, not code

Same reasoning as every other non-trivial feature in this project
(`CART_UX_SPEC.md`, `CHECKOUT_UX_SPEC.md`, `PRODUCT_CARD_WISHLIST_PDP_SPEC.md`):
authentication touches session security, the guest-checkout flow that's
already been carefully built and tested, and the cart's cookie-based
architecture — worth a look and an explicit yes before code, not a guess
implemented blind.
