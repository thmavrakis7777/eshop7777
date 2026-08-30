# Project Audit — MAVRAKIS HOME

**Written 2026-08-30, end of the "custom-dashboard-migration" line of sessions.**
This is the entry point for a new session that starts cold after a context
clear. Read this file first — it explains how the system works today and
lists exactly what a full audit found and fixed. `MIGRATION_PLAN.md` is the
detailed history of *how* the app got here (Medusa → direct SQL); this file
is the current, audited state. `PROJECT_MEMORY.md`/`CURRENT_STATE.md`/
`TASKS.md`/`NEXT_STEPS.md`/`ADMIN_GUIDE.md` describe the old Medusa v2
architecture and are historical only — do not use them for current facts.

---

## 1. Architecture

```
apps/storefront  (the only app — Next.js 16, App Router, Turbopack, Tailwind v4)
├── src/app/(storefront)/…   the shop — public routes
├── src/app/admin/…          the admin dashboard
│   ├── login/                outside the session gate
│   └── (protected)/…         everything else; layout enforces auth
├── src/lib/db/               server-only SQL: catalog, cart, checkout, customer, orders, content
├── src/lib/admin/            admin queries + Server Actions (all self-authenticate)
├── src/lib/auth/             scrypt password hashing, opaque server-side sessions
├── src/lib/data/             thin read wrappers the storefront/admin pages call
├── src/lib/actions/          storefront-facing Server Actions
└── db/                       numbered SQL migrations (0001–0026) + operational scripts
        ▼
Supabase Postgres — schema `shop` (44 tables, RLS enabled with zero policies on all of them)
```

- **Direct SQL via `postgres` (postgres.js) — no ORM, no supabase-js on the client.**
  Every DB call is server-only (`import "server-only"` at the top of every
  `lib/db/*.ts` file). Money is integer cents; prices are VAT-inclusive.
- **Medusa is completely gone** — verified this audit: zero `@medusajs`
  references, zero Medusa imports/env vars/routes anywhere in `src/`,
  `package.json`, or `.env.example`; no `apps/backend` directory exists.
  Total dependency footprint is 3 runtime packages beyond Next/React:
  `postgres`, `zod`, `server-only`.
- **Auth**: opaque server-side session tokens (SHA-256'd, stored in
  `shop.customer_session`/`shop.admin_session`), not JWTs — instantly
  revocable, no signing-secret rotation. Passwords hashed with scrypt.

## 2. Category system (main → sub → sub-sub)

- **Schema**: one self-referencing table, `shop.category(parent_id → shop.category.id)`,
  plus `shop.category_secondary_parent` (a true many-to-many edge table) for
  cross-listing a category under additional parents beyond its one primary
  parent. Primary `parent_id` is what determines the category's canonical
  URL/breadcrumb/sitemap position; secondary parents are for
  navigation/discovery only.
- **Depth is enforced, not just conventional**: `MAX_CATEGORY_DEPTH = 2`
  (zero-indexed: main=0, sub=1, sub-sub=2) lives in one shared module
  (`src/lib/category-depth.ts`) imported by both the server-side save guard
  (`assertDepthFits` in `src/lib/admin/taxonomy.ts`) and the admin form, so
  they can't drift apart. The storefront's URL structure
  (`/[category]/[subcategory]/[subsubcategory]`) is the real reason for the
  limit — a 4th level would be creatable but unreachable.
- **Cycle prevention, verified this audit**: re-parenting a category via its
  primary `parent_id` is checked against a recursive-CTE descendant walk
  (`saveCategory` in `taxonomy.ts`) before the UPDATE runs. Secondary-parent
  assignment is checked the same way but must walk *both* edge types
  (primary chain + secondary edges combined into one relation) — implemented
  in `saveCategorySecondaryParents`. Deleting a category refuses when it has
  children or assigned products (no orphaning).
- **Live data (2026-08-30)**: 159 categories, 12 products — both numbers
  changed significantly from the ~28/16 documented in `MIGRATION_PLAN.md`
  (2026-08-17). This is real, legitimate admin activity (a category
  restructuring — see `scratch/seo-taxonomy-*.sql`, dated 2026-08-26–28,
  timestamped one-off SQL the owner/a prior session ran directly against the
  category tree), not data corruption. Do not "fix" this back toward the old
  numbers.

## 3. Checkout

Guest-first, address autocomplete (Google Places, degrades to manual entry if
unconfigured), Greek tax documents (receipt vs. invoice with ΑΦΜ/ΓΕΜΗ
lookup), COD or bank transfer only (no card processor — deliberately not
built, see §6). `completeOrder` (`src/lib/db/checkout.ts`) is the single most
correctness-critical function in the codebase:

- The cart is locked `FOR UPDATE` and checked for `status = 'completed'`
  before anything is written — a double-submitted "place order" click
  produces one order and an "already completed" error, never two.
- Stock decrement's `WHERE` clause (`stock_quantity >= quantity`) *is* the
  concurrency control, not a separate check — two concurrent checkouts for
  the last unit cannot both succeed. Proven by `pnpm db:test-concurrency`.
- Re-prices from the live variant at completion time, never from the cart's
  display snapshot. Re-validates discount, shipping method, and payment
  method against current admin state at the same moment, inside the same
  transaction.
- Confirmation + owner-notification emails are sent *after* commit and never
  throw back to the customer — an email outage can't cost an already-placed,
  already-stock-deducted order.

**Not redesigned or touched by this audit** beyond what's listed in §12
"Bugs found and fixed."

## 4. Shipping

Custom system, not a carrier integration. `computeTotals` (`src/lib/db/cart.ts`)
is the single source of truth, imported (never reimplemented) everywhere a
total is shown or charged, including inside `completeOrder`:

- Shipping methods are admin-managed rows (`shop.shipping_method`): price,
  optional `free_over_cents` threshold, `is_pickup`, `heraklion_only`.
- **Heavy/oversized items**: a product's own `shipping_cost_cents` is a
  per-item surcharge added on top of the method's base price — multiple
  standard products combine under one flat method price; a heavy item adds
  its own surcharge regardless of how many other items are in the cart; a
  mixed cart combines both correctly (this is the exact logic covered by the
  "Heraklion + heavy product" test matrix mentioned in code comments).
- **Heraklion-only methods** are gated twice: once when the shipping option
  list is built (`getShippingOptionsForCart`) and again, authoritatively,
  inside `completeOrder` against the cart's *actual saved address* — a
  Heraklion-priced method can never be charged against a non-Heraklion
  address no matter what the client sent.
- `free_over_cents` and shipping method `price_cents` both carry a
  non-negative DB `CHECK` (migration `0024`) plus an action-level check —
  verified intact this audit, not touched.

**Not modified this audit** — re-verified against the live code, no
regression found, no business rule changed.

## 5. Payments

Only `cod` (cash on delivery) and `bank_transfer` exist — enforced by a DB
`CHECK` constraint on `shop.payment_method.code`, so no other code can ever
exist no matter what an admin does. No payment gateway is integrated; the
settings page renders a card option as a fixed "not configured" line, never
a toggle that could imply it works. This is a deliberate, standing decision
(a real processor is on hold pending the owner's own merchant account), not
a gap this audit should close.

## 6. Email

Resend, via a direct REST call (no SDK) — `src/lib/email/send.ts` /
`send-core.ts`. Transactional only: order confirmation, shipment
notification, password reset, welcome, password-changed, admin
notifications. `RESEND_API_KEY` + `RESEND_FROM_EMAIL` are required together;
if either is unset, sends are skipped with a logged
`EMAIL_CONFIG_MISSING` rather than blocking checkout/signup/reset — this is
why local dev never actually sends mail. Meta Conversions API
(`src/lib/analytics/capi.ts`) exists as prepared architecture with the same
graceful no-op, but has no call site yet — not a bug, just unbuilt.

## 7. Image uploads / Supabase Storage

Wired up (not the placeholder-only state `MIGRATION_PLAN.md` describes from
2026-08-19 is still accurate: `NEXT_PUBLIC_SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` configured, `isStorageConfigured()` gates the
admin upload UI, `next.config.ts`'s `images.remotePatterns` derives from the
Supabase URL). Upload/reorder/alt-text/primary-selection work for products,
hero blocks, and category images. `publicImageUrl()` (`src/lib/storage/urls.ts`)
is the one place a stored path becomes a public URL — used consistently
everywhere an image renders, now including the two SEO fixes in §12 (below).

## 8. SEO

Full audit re-verified this session against the state left by
`MIGRATION_PLAN.md`'s "Phase 15" — see §12 for what changed. Confirmed
intact and unregressed:

- Real per-route `generateMetadata`/`metadata` on all 39 storefront page
  routes — no generic fallback anywhere.
- `sitemap.ts`/`robots.ts` correctly walk the category tree to arbitrary
  depth, include products/categories/journal/collections, exclude
  admin/cart/checkout/account/wishlist.
- `noindex` + explicit self-canonical on cart/checkout/account/search/wishlist.
- Product/category/homepage JSON-LD (`src/lib/json-ld.ts`) never fabricates
  ratings or reviews — `product.rating` stays `undefined` (no review system
  exists), confirmed with no `aggregateRating` emitted anywhere.
- Pagination self-canonicalizes past page 1 (an admin canonical override
  only ever applies to page 1).
- Filtered listing URLs (`?material=…` etc.) are `noindex` but still
  crawlable — never compete with the real canonical listing page.

## 9. Security

Full audit re-verified this session against `MIGRATION_PLAN.md`'s "Phase
14." No regressions found; the loyalty-coupon backend added this session
(§13) was reviewed directly by this session (not by the parallel research
agent — see note in §12) and live-verified for the cross-customer ownership
check.

- **Every** exported function across `src/lib/admin/*-actions.ts` (~66 of
  them, grown from Phase 14's 40) authenticates itself with
  `requireAdmin()`/`requireOwner()` before touching its arguments — `proxy.ts`
  only checks a cookie *exists* as a redirect convenience, never as the real
  access control.
- **RLS**: all 44 `shop` tables have Row Level Security enabled with zero
  policies (full lockdown) — enforced by a loop in migration `0001_init.sql`
  that runs on every `db:migrate`, so any table added later (including
  today's `0025`/`0026`) is covered automatically, not by a per-table
  opt-in someone has to remember.
- **Secrets**: `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`RESEND_API_KEY`/etc.
  only ever appear in files starting with `import "server-only"`;
  `next.config.ts` only reads `NEXT_PUBLIC_*` vars. No secret reaches the
  client bundle.
- **Rate limiting** (`checkRateLimit`, Postgres-backed, fails open on a DB
  error — a deliberate, documented availability trade-off) covers: login,
  register (including the account-creation-during-checkout call site),
  password reset, promo-code apply, newsletter, admin login, Google Places
  autocomplete/details, ΓΕΜΗ/ΑΦΜ lookup, AI SEO generation.
- **SQL injection**: every query across the codebase is a `postgres.js`
  tagged template with parameters — zero raw string interpolation, spot-checked
  again this audit including every file touched this session.
- **IDOR**: a customer's own session id gates order detail
  (`getOrderById`), address book, and (new this session) loyalty-coupon
  redemption — a mismatched viewer gets `null`/"unknown code", indistinguishable
  from "doesn't exist."

## 10. CSP

`src/proxy.ts` generates a real per-request nonce (`crypto.randomUUID()`,
base64-encoded) — verified directly this audit, not just via the research
agent's report:

- `script-src 'self' 'nonce-{nonce}' 'strict-dynamic'` — `unsafe-eval` is
  appended **only** in dev.
- `style-src` deliberately carries `unsafe-inline` (React's `style={{...}}`
  prop attributes need it; a nonce can only whitelist `<style>` *elements*,
  not inline `style=""` attributes — this is a documented, understood
  trade-off, not an oversight) while `style-src-elem` keeps the strict
  nonce in production.
- The nonce is threaded through `x-nonce` request header → every JSON-LD
  `<script>` tag and every dynamically-injected analytics `<script>`
  (`AnalyticsScripts.tsx`) — confirmed no untagged inline script exists.

**Not modified this audit** — matches the task's explicit instruction not to
weaken or "fix" a CSP that was deliberately implemented and already verified.

## 11. Dashboard

Products, Categories (3-level), Orders, Shipping, Payments, Content/CMS
(homepage blocks, header/footer, promo banner, static pages, journal),
Settings (site settings, analytics, search synonyms, admin users) — all
re-verified this audit via full code reading (no live click-through; no
admin credentials available to this session). One real bug found and fixed,
see §12. Otherwise: singleton-row forms (site settings, email settings,
promo banner) each write their own exact column set and cannot blank
sibling fields on save; category delete refuses when in use; shipping
method delete disables instead of deleting once it's been ordered against;
last-owner protection is checked on both deactivate and demote.

## 12. Bugs found and fixed this audit

| # | Bug | File | Fix |
|---|---|---|---|
| 1 | **Negative stock could be saved through the product-variant editor.** `saveVariantAction` parsed `Number(formData.get("stock")) \|\| 0` with no lower bound; `stock_quantity` had no DB constraint (unlike `price_cents`, which does). A typo like `-3` would corrupt total-stock sums, the low-stock filter, and storefront availability logic that assumes non-negative stock. | `src/lib/admin/catalog-actions.ts` | Action-level guard added (same message/pattern `adjustStockAction`/`setStockAction` already use) **and** a DB `CHECK (stock_quantity >= 0)` added via migration `0026_variant_stock_nonneg.sql` — same defense-in-depth pattern already used for `shipping_method.free_over_cents` in `0024`. Verified zero existing rows violated it before applying. |
| 2 | **Product and category pages had no `twitter` metadata of their own**, so sharing a product or category link on Twitter/X silently showed the site-wide generic title/description instead of that page's real one (Next only replaces a parent's `openGraph`/`twitter` metadata when the child declares that same key). `journal/[slug]/page.tsx` already had the correct pattern — it just wasn't applied to products/categories. | `src/app/(storefront)/proionta/[handle]/page.tsx`, `src/lib/category-route.ts` | Added a matching `twitter` block (`summary_large_image` when an image exists, `summary` otherwise) to both. Live-verified: a product page now serves its own real title + real photo in both `og:image` and `twitter:image`. |
| 3 | **Product and category Open Graph tags never fell back to the entity's own real photo** — only an admin-entered `socialImageUrl` override populated `og:image`; with no override (the common case), sharing a product/category link showed no preview image at all, even though real photography now exists via Supabase Storage (this gap predates real photos existing, so it was never exercised until now). | Same two files as #2 | `openGraph.images`/`twitter.images` now fall back to `product.imageUrl` / `publicImageUrl(category.imagePath)` when no override is set — same fallback pattern already proven in `journal/[slug]/page.tsx`. Live-verified on a real product page. |

No other genuine bugs were found. Two lower-confidence items were
investigated and deliberately **not** changed: (a) `bulkAddToCollection`'s
"affected" count under-reports when some products were already in the
collection — cosmetic message only, no data issue; (b) a negative *price*
(already blocked by an existing DB `CHECK`) surfaces as a generic
"Κάτι πήγε στραβά" rather than a friendly message — a UX rough edge, not
data corruption, left alone per this audit's "don't touch working things"
mandate.

## 13. This session's other work (context for what's uncommitted)

Before this audit, the same session built, then partially removed, a
loyalty-reward feature (a system-issued €5 coupon for a logged-in customer's
qualifying ≥€50 order). The user asked to remove it from checkout
specifically; the backend piece stayed, on purpose:

- **Still active**: `db/migrations/0025_loyalty_reward.sql` (two nullable
  columns + a unique-index idempotency guard on `shop.discount`), coupon
  issuance inside `completeOrder`'s existing transaction
  (`src/lib/db/checkout.ts`), the per-customer ownership check on
  `applyDiscount` (`src/lib/db/cart.ts`), `listCustomerLoyaltyCoupons`
  (`src/lib/db/customer.ts`), the dashboard's "Τα κουπόνια μου" list, the
  order-confirmation page/email mention, the admin discount-list owner
  badge, and the admin-configurable expiry setting (default 60 days,
  Admin → Content → Header & Footer). All of this was live-verified against
  the real production database earlier in this same session (a real guest
  checkout → account creation → coupon issuance → cross-customer redemption
  rejection, end to end), then re-verified clean by this audit's typecheck/
  lint/build passes.
- **Removed on request**: the checkout-page banner/checkbox/password field
  (`LoyaltyRewardSection.tsx`, deleted) and the "create account during
  checkout" mechanism that only existed to serve it
  (`src/lib/actions/checkout.ts` is back to its original, unmodified form).
  A guest shopper today has no way to opt into an account at checkout, so a
  guest never earns the reward — only an already-logged-in customer does,
  silently.
- **Also live, separately**: the site-wide promo banner (Admin → Content →
  Header & Footer → Promo banner) was edited and published with real copy
  advertising the coupon — this is a **database content change**, not code,
  done through the same mechanism the admin form itself uses. Nothing to
  commit for it; it's just live.

Full spec/history: `LOYALTY_REWARD_SPEC.md` (repo root).

## 14. Dead code / unnecessary code removed

- `src/components/checkout/LoyaltyRewardSection.tsx` — deleted (see §13).
- The account-creation-during-checkout mechanism in
  `src/lib/actions/checkout.ts` (`tryCreateAccountDuringCheckout`,
  `CreateAccountDuringCheckout` type, the `createAccount` param on
  `completeCheckoutAction`) — removed; it had no remaining caller.
- A temporary debug `console.error` added and removed during this session's
  own live-testing (confirmed not present in the final diff).
- Full-repo sweep this audit: zero `console.log` debug leftovers (one
  legitimate informational `console.log` in `src/lib/analytics/capi.ts`,
  mirroring the codebase's own `_NOT_CONFIGURED`/`_MISSING` logging
  convention — left alone), zero `TODO`/`FIXME`/`XXX` markers, zero
  orphaned source files (heuristic scan: every file under `src/lib` and
  `src/components` is referenced by name from at least one other file).
- `.gitignore` gained a `scratch/` entry (one-off admin SQL scripts and
  preview HTML files from prior sessions, dated 2026-08-23–28) — matching
  the existing `backups/` pattern, so this throwaway-by-design directory
  can never be accidentally `git add`ed. Nothing in it was touched or
  deleted.

## 15. Performance

Not independently re-audited in full this session (`MIGRATION_PLAN.md`'s
"Phase 16" already did the deep pass — query shapes, indexes, bundle
composition, `unstable_cache`/`React.cache()` coverage, Suspense
boundaries — and nothing in this session's changes touches a hot path).
Spot-checked: the two new SEO metadata fixes (§12) add zero new queries
(`product.imageUrl`/`category.imagePath` were already being fetched for
the page's own rendering); the loyalty-coupon issuance (§13) happens inside
`completeOrder`'s existing single transaction, adding at most 2-3 extra
statements to a checkout-completion path that already runs once per order,
not on any hot read path.

**One standing, previously-documented concern, unchanged by this
audit**: `DATABASE_URL` is still on Supabase's session-mode pooler (port
5432, 15-connection hard cap) — a real production connection-exhaustion
risk under real concurrent traffic once it exists, deferred pending
Supabase dashboard access to diagnose why transaction-mode pooling (port
6543) previously broke every query with a statement-timeout error. See
`DEPLOYMENT.md` for the full history.

## 16. Environment variables (names only)

Required: `DATABASE_URL`.
Recommended for production: `NEXT_PUBLIC_SITE_URL`.
Required together for email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
Optional, each independently: `RESEND_REPLY_TO_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`
+ `SUPABASE_SERVICE_ROLE_KEY` (required together, for image upload),
`GOOGLE_PLACES_API_KEY`, `GEMI_API_KEY`, `META_FEED_TOKEN`,
`META_CAPI_ACCESS_TOKEN` + `META_DATASET_ID` (together), `GEMINI_API_KEY`,
`GEMINI_MODEL`.

Audited this session: every variable above is actually referenced in code;
every `process.env.*` reference in code that isn't a Next.js/Node/Vercel
platform builtin (`NODE_ENV`, `VERCEL_URL`, `NEXT_PHASE`) is documented in
`.env.example` with why it exists and what happens when it's unset. No
unused variables, no undocumented variables, no Medusa-era variables
remaining. Full descriptions (never values) live in `.env.example` — read
that file, not this one, for setup instructions.

## 17. Deployment

Vercel project `eshop7777` (team `harris-7777`), connected to this repo's
`main` branch, auto-deploys on push. Live domains: `mavrakishome.gr`,
`www.mavrakishome.gr`, `mavrakishome.com`, `www.mavrakishome.com` (all
aliased to the same deployment). Database: the same Supabase Postgres
project is used for both local dev and production — **there is no separate
staging database**; running `pnpm db:migrate` or any direct script against
`DATABASE_URL` from a local machine touches the real live data. See
`DEPLOYMENT.md` for the full runbook and the pooler-mode history.

## 18. Important files (orientation for a new session)

- `src/lib/db/checkout.ts` — order completion (see §3).
- `src/lib/db/cart.ts` — `computeTotals` (see §4), discount application.
- `src/lib/db/customer.ts` / `src/lib/auth/session.ts` — accounts and sessions.
- `src/lib/admin/*.ts` + `*-actions.ts` — every admin read/write, each
  self-authenticating.
- `src/proxy.ts` — CSP + nonce (see §10).
- `src/lib/category-depth.ts` — the one shared category-depth constant.
- `db/migrations/*.sql` — numbered, applied in order via `pnpm db:migrate`;
  never edit an already-applied one, add a new number.
- `.env.example` — the real setup/env-var reference.
- `MIGRATION_PLAN.md` — how the Medusa→SQL migration happened (history).
- `LOYALTY_REWARD_SPEC.md` — the loyalty-coupon feature spec (§13).

## 19. Important routes

Storefront: `/`, `/[category]`, `/[category]/[subcategory]`,
`/[category]/[subcategory]/[subsubcategory]`, `/proionta/[handle]`,
`/kalathi`, `/checkout`, `/checkout/epibebaiosi`, `/anazitisi`,
`/logariasmos/*`, `/journal/*`, `/syllogi/[slug]`.
Admin: `/admin/login`, `/admin/(protected)/{products,categories,orders,
discounts,customers,inventory,journal,content/*,settings/*}`.
API: `/api/meta/product-feed` (token-gated), `/sitemap.xml`, `/robots.txt`.

## 20. Known intentional design decisions (do not "fix" these)

- No payment gateway — COD/bank transfer only, on hold pending the owner's
  own merchant account (§5).
- No product review/rating system — JSON-LD and product cards never show a
  rating, by design, not a missing feature.
- `style-src 'unsafe-inline'` in the CSP — required by React inline `style`
  props, not a security oversight (§10).
- Session-mode DB pooler — a measured trade-off, not an accident (§15,
  `DEPLOYMENT.md`).
- Rate limiter fails open on a DB error — availability over strictness for
  a login throttle, documented in the code's own comments.
- `Hero.tsx`'s `<img>` (not `next/image`) — required for the `<picture>`/
  `<source>` art-directed responsive hero image; `next/image` can't do
  that. The one ESLint warning in the whole codebase is this, and it's
  correct to leave it.
- `/syllogi/[slug]` (collections) metadata still lacks the same OG-image/
  Twitter fallback added to products/categories this audit — deliberately
  deferred: zero real collections exist in production today, so there's
  nothing to verify the fix against yet. Apply the same pattern
  (`journal/[slug]/page.tsx`'s, or the now-fixed product/category pages)
  once a real collection exists.

---

*Maintained by whichever session last ran a full audit. Update the "Bugs
found and fixed" and "known intentional decisions" sections rather than
letting them go stale — the whole point of this file is that the next
session shouldn't have to re-derive any of this from scratch.*
