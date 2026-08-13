# Migration Audit — Medusa v2 → Custom Next.js + Supabase Commerce Platform

**Status: AUDIT ONLY. Nothing migrated, nothing deleted, nothing installed, no database
writes, no storefront changes.** Produced 2026-08-13 against the repo at commit `da14834`
and a live read-only inspection of the production Supabase database.

Read this end to end, then approve, reject, or amend. Implementation starts only on your
explicit go-ahead.

---

## 0. How this audit was produced (so you can trust the numbers)

- Full repo read: `apps/storefront` (10,625 LOC TS/TSX), `apps/backend` (4,682 LOC excl.
  migrations), all 14 root docs, `package.json`s, env var *names* (never values), git history.
- **Live database inspection.** There is no `psql` on this machine and no `node_modules`
  installed anywhere, and you told me not to install dependencies — so I wrote a
  dependency-free, read-only PostgreSQL wire-protocol client in the scratchpad
  (`scratchpad/pg.mjs`, ~180 lines, TLS + SCRAM-SHA-256) and ran `SELECT`s only.
  No `INSERT`/`UPDATE`/`DELETE`/`ALTER` was issued. No personal data was read: all
  customer/order/admin figures below are `COUNT(*)`/aggregates, never emails, names,
  phones or addresses.
- Every count in this document is a live number from your real database, not an estimate
  and not carried over from the project docs.

### Three findings that change the shape of the project

**1. There is no existing Supabase integration to build around.**
Your brief describes migrating "around our existing Next.js/React/Tailwind + Supabase
architecture." In reality there is **zero Supabase code in this repo** — confirmed by
full grep: no `supabase-js`, no PostgREST client, no Supabase Auth, no Supabase Storage.
Live check: `auth.users` = **0 rows**, `storage.buckets` = **0**, `storage.objects` = **0**.
Supabase today is *purely the Postgres host that Medusa connects to* with a privileged
`postgres` role. That doesn't weaken the plan — it just means "Supabase becomes the core
backend" is **greenfield work**, not a matter of extending something that exists.

**2. The storefront is already almost perfectly decoupled from Medusa.**
There is a real anti-corruption layer: `src/lib/medusa.ts` (Medusa wire types) →
`src/lib/data/*.ts` (mappers) → `src/lib/types.ts` (your own domain model) → components.
**All 69 components consume `Product`/`Cart`/`Order`/`Customer` domain types — not one
imports a Medusa type.** The entire Medusa surface is 12 files in `src/lib/`. This is the
single most valuable asset in the project and it makes the storefront half of this
migration far cheaper than it looks.

**3. There is essentially nothing to lose.**
Nothing is deployed. No live site, no live backend, no real customers, no real orders,
no real revenue. Live data: **16 real products** (4 more are soft-deleted Medusa demo
items), 28 real categories, **0 real product photographs**, 7 customers (3 with accounts,
all test), 4 test orders (all `pending`, all created by you during development), 4 test
promo codes, 3 price lists literally named "Test Sale". **This is the cheapest moment
this migration will ever be.** Every month you wait, it gets more expensive.

---

## 1. Complete Medusa dependency map

### 1.1 Packages, config, tooling

| Dependency | What it does | Where | Replace? | Replacement |
|---|---|---|---|---|
| `@medusajs/medusa` v2.18.0 + framework/CLI | The entire backend runtime | `apps/backend/apps/backend` | **Delete** | Next.js Server Actions + route handlers |
| `@medusajs/eslint-plugin` | Medusa lint rules | `apps/backend/package.json` | **Delete** | Existing `eslint-config-next` |
| `@medusajs/auth-emailpass` | Customer/admin password auth | Backend module | **Rebuild** | Custom `scrypt` auth (§8.5) |
| `@medusajs/notification-sendgrid` | Order + password-reset email | `medusa-config.ts` | **Rebuild** | Direct SendGrid REST call from Next.js |
| `@medusajs/medusa/fulfillment` + `fulfillment-manual` | Shipping option engine | `medusa-config.ts` | **Rebuild (trivially)** | `shipping_method` table — 3 flat-rate rows |
| `@medusajs/medusa/notification-local` | Admin in-app feed | `medusa-config.ts` | **Drop** | Not needed |
| Turborepo + nested pnpm workspace | Builds the nested monorepo | `apps/backend/**` | **Delete** | Single app, no Turbo |
| `medusa db:migrate` / `db:generate` | Schema migrations | CLI | **Replace** | Plain, numbered `.sql` files |
| `.medusa/` build output | Compiled admin SPA | `apps/backend/apps/backend/.medusa` | **Delete** | 500+ files of build debris |

The storefront's own `package.json` has **no Medusa dependency at all** — only `next`,
`react`, `react-dom`. It talks to Medusa over plain HTTP.

### 1.2 The Medusa API surface actually consumed (complete list)

Every endpoint the storefront calls, extracted from source. This *is* the contract the
new backend must satisfy — nothing more.

**Catalog (read)**
| Endpoint | Used by | Replacement |
|---|---|---|
| `GET /store/products` | `data/products.ts` — 8 functions | SQL on `shop.product` |
| `GET /store/product-categories` | `data/categories.ts` | SQL on `shop.category` |
| `GET /store/regions` | `getDefaultRegionId()`, called by *every* catalog fn | **Deleted entirely** — single EUR/Greece store |

**Cart & checkout (read + write)**
| Endpoint | Used by | Replacement |
|---|---|---|
| `POST /store/carts`, `GET/POST /store/carts/:id` | `actions/cart.ts`, `actions/checkout.ts` | SQL on `shop.cart` |
| `POST/DELETE /store/carts/:id/line-items[/:id]` | `actions/cart.ts` | SQL on `shop.cart_item` |
| `POST/DELETE /store/carts/:id/promotions` | `actions/cart.ts` | `shop.discount` + validation |
| `POST /store/carts/:id/shipping-methods` | `actions/checkout.ts` | `cart.shipping_method_id` |
| `GET /store/shipping-options` | `data/checkout.ts` | SQL on `shop.shipping_method` |
| `GET /store/payment-providers` | `data/checkout.ts` | Static config (one method today) |
| `POST /store/payment-collections[/:id/payment-sessions]` | `actions/checkout.ts` | **Deleted** — pure Medusa ceremony for COD |
| `POST /store/carts/:id/complete` | `actions/checkout.ts` | **Transactional order-creation function (§8.6) — highest-risk item** |
| `GET /store/orders`, `/store/orders/:id` | `data/checkout.ts`, `data/customer.ts` | SQL on `shop.order` |

**Customer & auth**
| Endpoint | Used by | Replacement |
|---|---|---|
| `POST /auth/customer/emailpass` (login) | `actions/customer.ts` | Custom session auth |
| `POST /auth/customer/emailpass/register` | `actions/customer.ts` | Custom, **single transaction** (fixes an existing bug — §6.4) |
| `POST /auth/token/refresh` | `actions/customer.ts` | **Deleted** — opaque server sessions don't need refresh |
| `POST /auth/customer/emailpass/reset-password` + `/update` | `actions/customer.ts` | `shop.password_reset_token` |
| `GET/POST /store/customers[/me]` | `data/customer.ts` | SQL on `shop.customer` |
| `*/store/customers/me/addresses[/:id]` | `actions/customer.ts` | SQL on `shop.customer_address` |
| `POST /store/customers/me/password` | Custom route already written by you | Direct SQL |

**Custom modules you built on top of Medusa (10 of them)**
| Endpoint | Backend module | DB table | Rows | Replacement |
|---|---|---|---|---|
| `/store/site-settings` | `site-settings` | `site_setting` | 1 | `shop.site_setting` |
| `/store/seo` | `seo` | `seo` | 3 | `shop.seo_meta` |
| `/store/content-pages` | `content-pages` | `content_page` | 1 | `shop.content_page` |
| `/store/homepage-blocks` | `homepage-blocks` | `homepage_block` | **0** | `shop.homepage_block` |
| `/store/product-extras` (+ `/search-overrides`) | `product-extras` | `product_extra` | 1 | Merged into `shop.product` columns |
| `/store/search-synonyms` | `search-synonyms` | `search_synonym` | **0** | `shop.search_synonym` |
| `/store/promo-banner` | `promo-banner` | `promo_banner` | 1 | `shop.promo_banner` |
| `/store/analytics-settings` | `analytics-settings` | `analytics_setting` | 1 | `shop.analytics_setting` |
| (admin only) | `media-assets` | `media_asset` | **0** | Real Supabase Storage (§14) |
| (fulfillment provider) | `store-pickup` | — | — | A row in `shop.shipping_method` |

These 10 modules are ~4,700 LOC of backend + admin UI. **All of it is deleted** — the
data models survive as ~8 simple tables, and the admin UI is rebuilt far better in your
own dashboard.

### 1.3 Medusa-specific configuration and environment

| Item | Location | Action |
|---|---|---|
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | storefront `.env.local`, `.env.example`, `next.config.ts` | **Remove** |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | storefront `.env.local`, `.env.example`, `lib/medusa.ts` | **Remove** |
| `STORE_CORS` / `ADMIN_CORS` / `AUTH_CORS` | backend `.env` | **Remove** — same-origin, CORS becomes irrelevant |
| `JWT_SECRET` / `COOKIE_SECRET` / `AUTH_MFA_ENCRYPTION_KEY` | backend `.env` | **Remove**; new `SESSION_SECRET` |
| `MEDUSA_ADMIN_ONBOARDING_TYPE` | backend `.env` | **Remove** |
| `DATABASE_URL` | backend `.env` | **Keep** — moves to storefront (server-only) |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | backend `.env.template` | **Keep** — moves to storefront |
| `GOOGLE_PLACES_API_KEY` / `GEMI_API_KEY` | storefront (already server-only) | **Keep unchanged** |
| `railway.json`, `render.yaml` (uncommitted) | `apps/backend/` | **Delete** — no separate backend to host |
| `next.config.ts` `remotePatterns` deriving the Medusa host | storefront | **Rewrite** → Supabase Storage host |

### 1.4 Medusa database footprint

**152 tables in `public`, 89 with data, 63 empty.** The new system needs ~22.
Full breakdown in §3.

### 1.5 Medusa-specific frontend code (the entire storefront blast radius)

| File | LOC | Medusa refs | Action |
|---|---|---|---|
| `lib/medusa.ts` | 271 | 55 | **Delete entirely** |
| `lib/data/products.ts` | 439 | 20 | Rewrite internals; **exported signatures unchanged** |
| `lib/data/categories.ts` | 78 | 6 | Rewrite internals |
| `lib/data/cart.ts` | 112 | 8 | Rewrite internals |
| `lib/data/checkout.ts` | ~120 | 9 | Rewrite internals |
| `lib/data/customer.ts` | 94 | 12 | Rewrite internals |
| `lib/data/{seo,site-settings,promo-banner,homepage-blocks,content-pages,product-extras,search-management,analytics-settings}.ts` | ~350 | 29 | Rewrite internals (one SQL query each) |
| `lib/actions/cart.ts` | 134 | 10 | Rewrite internals |
| `lib/actions/checkout.ts` | 272 | 16 | Rewrite internals |
| `lib/actions/customer.ts` | 270 | 22 | Rewrite internals |
| `lib/types.ts` | 227 | 11 | **Comments only** — types stay |
| 8 components + `sitemap.ts` | — | 1–3 each | **Comment references only, zero logic** |

**Total real rewrite: ~2,100 LOC across 12 files, behind stable exported function
signatures.** Everything else in the storefront — all 69 components, all 37 routes, the
entire design system — is untouched.

---

## 2. Existing functionality map — what is preserved (not rebuilt)

Verified present in code. **Everything in this table survives the migration with no
component changes**, because the data layer keeps the same exported functions and the
same domain types.

| Area | Implementation | Migration impact |
|---|---|---|
| Homepage (hero + carousel, category grid, 2 product rails, editorial banner, trust strip, newsletter) | `app/page.tsx` + `components/home/*` | **None** |
| Header, sticky, mega menu, mobile drawer | `components/layout/Header.tsx`, `MobileMenu.tsx` | **None** |
| Footer, announcement bar, promo banner bar | `components/layout/*` | **None** |
| **Greek accent-insensitive search** (NFD strip, final-sigma fold, bounded Levenshtein, tiered ranking, synonyms, admin boost/hide) | `lib/search.ts` + `lib/data/search-management.ts` | **`lib/search.ts` is pure TypeScript with zero Medusa coupling — kept verbatim, and gets *faster* (one SQL query instead of a 1000-product HTTP fetch)** |
| Product cards, SKU display, badges, stock status | `components/product/*` | **None** |
| PDP: price, compare-at, variants, characteristics, related, recently-viewed, JSON-LD | `app/proionta/[handle]` | **None** |
| Categories + subcategories, breadcrumbs, sort, infinite scroll + `<noscript>` pagination | `app/[category]/[subcategory]`, `components/category/*` | **None** |
| New Arrivals (rolling 30-day window OR admin tag) | `data/products.ts` | Logic preserved; tag → `product.is_new_override` boolean |
| Recommended / cross-sell (honest same-category, no fabricated "bestsellers") | `data/products.ts` | Preserved; **can finally become real** once orders exist |
| Wishlist (localStorage) | `components/wishlist/*` | **None** — plus optional account sync (§5) |
| Cart drawer + full page, quantity steppers, coupons, free-shipping progress, mini-cart | `components/cart/*` (13 files) | **None** |
| Sale pricing / original price / discount % | Derived in `toDomainProduct` | **None** (source changes to SQL) |
| Checkout: Greek address form, Οδός/Αριθμός split, Google Places autocomplete, ΑΦΜ checksum + ΓΕΜΗ lookup, receipt/invoice (Απόδειξη/Τιμολόγιο), store pickup | `components/checkout/*` (13 files) | **None** — Places/ΓΕΜΗ actions never touched Medusa |
| Guest checkout | `actions/checkout.ts` | Logic rewritten, UX identical |
| Customer accounts: register/login/logout/forgot/reset, profile, address book, order history, change password | `app/logariasmos/*`, `components/account/*` | Forms unchanged; auth backend rewritten |
| SEO: `generateMetadata`, canonical (pagination-aware), sitemap, robots, Open Graph, JSON-LD (Organization/Product/BreadcrumbList) | `app/**`, `lib/site-config.ts` | **None** — only the data source changes |
| CSP with per-request nonces, `strict-dynamic`, split `style-src`/`style-src-elem` | `src/proxy.ts` | **Preserved**; extend for admin + Supabase Storage (§8.7) |
| Security headers, httpOnly cookies | `next.config.ts`, actions | **None** |
| Analytics + consent gating (GA4/GTM/Pixel/Clarity, script injected only after opt-in) | `components/layout/{ConsentBanner,AnalyticsScripts}.tsx` | **None** |
| Server Components everywhere; 46 client components, all genuinely interactive | throughout | **Preserved and improved** |

**Nothing in this table gets rebuilt. That is the point of §2 of your brief and it is
achievable exactly as written.**

---

## 3. Existing Supabase schema assessment (live)

`PostgreSQL 17.6`, Supabase pooler `aws-1-eu-west-1`, 152 public tables, 606 indexes.
Extensions installed: `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `plpgsql`,
`supabase_vault`. **No `unaccent`, no `pg_trgm`** — relevant to §5's search decision.

### 3.1 Real business data (must be preserved)

| Entity | Live count | Notes |
|---|---|---|
| **Products** | **16 real** | +4 Medusa demo (`t-shirt`, `sweatshirt`, `shorts`, `sweatpants`) already **soft-deleted** |
| **Categories** | **28 real** (6 top-level + 22 sub) | +4 demo (`shirts`/`pants`/`sweatshirts`/`merch`) |
| Variants | 36 total | **16 real products = 1 variant each.** The 4/8-variant products are all demo |
| SKUs | 36/36 populated | Real, unique, customer-facing product codes |
| Product images | **1** (a `localhost:9000` URL) | The other 10 belong to demo products (AWS demo bucket). **Effectively zero real photography** |
| Base prices | 42 EUR rows | +22 USD demo rows |
| Sale prices | 3 (via price lists) | All 3 lists titled "Test Sale…" |
| Inventory levels | 36 | 5 units reserved; **0 out of stock**; one seeded quantity is absurd (20,000,000) |
| Customers | 7 (3 with account, 4 guest) | All test accounts |
| Orders | 4 | All `status = pending`, €41.41 / €52.90 / €83.80 / €46.90, created 8–9 Aug during development |
| Admin users | 8 | 6 are disposable `qa-agent` accounts your own `TASKS.md` already says to delete |
| Promotions | 4 | `TESTCART10`, `VERIFY10`, `CLARITY10`, `CHECKOUTTEST10` — all 10% order-level test codes |
| CMS singletons | `site_setting` 1, `promo_banner` 1, `analytics_setting` 1, `seo` 3, `content_page` 1 (unpublished, empty body), `product_extra` 1 (blank badge) | Real but tiny |
| **Empty despite being built** | `homepage_block` 0, `media_asset` 0, `search_synonym` 0, `product_collection` 0, `product_tag` 0 | Features exist in code but were never populated |

### 3.2 Configuration data

- **1 region** ("Europe", EUR, `automatic_taxes = true`) covering **250 country rows** —
  but you sell only in Greece.
- **8 tax regions, and `tax_rate` is EMPTY — 0 rows.** **Your store currently applies
  zero VAT.** Greek ΦΠΑ is 24%. See §6.3 — this is a real commercial finding, not a
  migration artifact.
- 3 shipping options: Standard, Express, Παραλαβή από το κατάστημα (flat rate).
- 1 payment provider: `pp_system_default`, surfaced as "Αντικαταβολή" (COD).
- 1 sales channel, 1 stock location, 1 store, 1 publishable API key.

### 3.3 RLS assessment — important nuance

**All 152 public tables have RLS enabled with exactly 0 policies** (verified:
`pg_policies` where `schemaname='public'` returns 0; no table has `relrowsecurity=false`).

This is a **full lockdown**, and it is the correct posture *today*: nothing uses
PostgREST, and Medusa's `postgres` role bypasses RLS, so the lockdown costs nothing and
closes the Supabase Data API exposure entirely.

**Design consequence:** if the new system used `supabase-js` from the browser, you would
have to author ~30+ RLS policies and deliberately open the Data API — strictly weakening
today's posture. §8.2 recommends against that. Putting the new tables in a **separate
`shop` schema** keeps them outside PostgREST's exposed schema list by default, which is
even stronger than the current lockdown.

### 3.4 What Medusa's schema does badly for you

- **Prices via `price_set` → `price_rule` → `price`**: 4 tables and a rules engine to
  express "this product costs €24.90." Reading one product's price server-side is a
  multi-join. A `price_cents` column is a 100× simplification.
- **Sale price via `price_list`**: a separate list entity with rules, rather than a
  `compare_at_price_cents` column. Your storefront already flattens it back to
  "calculated vs original" on read.
- **Orders spread across 12 tables** (`order`, `order_item`, `order_line_item`,
  `order_summary`, `order_shipping`, `order_change`, `order_claim`, `order_exchange`,
  `order_transaction`, `return`, `credit_line`, `capture`) with totals stored as JSON
  blobs containing `raw_*` precision wrappers. A single `order` + `order_item` pair with
  integer cents columns replaces all of it for your use case.
- **63 empty tables** are pure schema tax: returns, exchanges, claims, campaigns, MFA,
  RBAC, tax rules, view configurations, workflow executions.

---

## 4. What can be reused

**Reused verbatim, zero changes (~85% of the storefront):**
- All 37 route files, all 69 components, `globals.css`, the whole design system.
- `lib/types.ts` — the domain model. **This becomes the schema's design brief.**
- `lib/search.ts` — Greek search engine, pure TS, no Medusa.
- `lib/format.ts`, `lib/site-config.ts`, `lib/cart-config.ts`, `lib/pickup-config.ts`,
  `lib/checkout-validation.ts`, `lib/search-params.ts`, `lib/consent-storage.ts`,
  `lib/wishlist-storage.ts`, `lib/recently-viewed-storage.ts`.
- `lib/actions/address-autocomplete.ts` (Google Places), `lib/actions/afm-lookup.ts`
  (ΓΕΜΗ), `lib/actions/wishlist.ts`, `lib/actions/recently-viewed.ts` — never touched Medusa.
- `src/proxy.ts` CSP (extended, not replaced).
- `next.config.ts` security headers.

**Reused as design/spec input:**
- The 10 custom module models → 8 new tables, near 1:1 field mapping.
- Your `.md` specs (`CART_UX_SPEC`, `CHECKOUT_PREMIUM_SPEC`, `PRODUCT_CARD_WISHLIST_PDP_SPEC`,
  `ACCOUNT_SYSTEM_SPEC`, `ADMIN_GUIDE`) — the behavioural contract to preserve.
- The Greek error-copy tables in `actions/cart.ts` / `actions/checkout.ts` — keep the
  strings, change what maps to them.

**Reused infrastructure:**
- The Supabase Postgres instance and its 606 indexes' design lessons.
- Supabase Storage (currently empty — becomes the image backend).
- Vercel project (already connected, root dir already fixed).

**Reused data:** the 16 products, 28 categories, 36 SKUs, prices, stock, and the CMS
singleton rows.

---

## 5. What must be rebuilt

| # | Thing | Why it can't be reused | Size |
|---|---|---|---|
| 1 | Database schema (`shop`, ~22 tables) | Doesn't exist | M |
| 2 | DB access layer (pooled client, query helpers, transactions) | Doesn't exist | S |
| 3 | Catalog read layer | Currently HTTP→Medusa | M |
| 4 | Cart engine (create/add/update/remove/totals/expiry) | Medusa-owned | M |
| 5 | Discount engine (validate, apply, redemption limits) | Medusa Promotions | M |
| 6 | Inventory (stock, reserve on order, release on cancel) | Medusa Inventory module | M |
| 7 | **Checkout completion (transactional order creation)** | Medusa workflow — **the single hardest piece** | **L** |
| 8 | Customer auth (register/login/session/reset/change) | Medusa auth provider | M |
| 9 | Order model + numbering + status history | 12 Medusa tables | M |
| 10 | Transactional email (order confirm, password reset) | Medusa subscribers + SendGrid module | S |
| 11 | **Entire admin dashboard** | Medusa Admin SPA is deleted | **XL** |
| 12 | Admin auth + RBAC + rate limiting | Medusa admin auth | M |
| 13 | Image upload/reorder/alt/primary via Supabase Storage | Never existed (Media Library is URL-only) | M |
| 14 | CMS read/write for 8 content tables | Medusa custom modules | M |
| 15 | Collections | `product_collection` is empty — **greenfield, not a migration** | S |
| 16 | Data migration + verification scripts | Doesn't exist | M |

---

## 6. Migration risks

Ranked by expected damage, with the mitigation baked into the phase plan.

### 6.1 HIGH — Order completion correctness
Medusa gives you atomic "reserve stock → create order → number it → clear cart" for free.
A naive rebuild double-sells stock under concurrency or creates orphaned orders.
**Mitigation:** a single `BEGIN … COMMIT` server function; stock decrement via
`UPDATE … SET stock = stock - $1 WHERE id = $2 AND stock >= $1` with a row check (not
read-then-write); order numbers from a Postgres `SEQUENCE`, never `MAX(id)+1`; cart
cleared only after commit. Phase 6, with an explicit concurrency test.

### 6.2 HIGH — Admin dashboard scope creep
§6–§13 of your brief describe a genuinely large product. The temptation is to build
"€100M polish" on every screen at once and stall for weeks.
**Mitigation:** ship the dashboard in 5 phases (7–11), each independently usable; build
one shared primitive set (table, form, drawer, empty state, confirm dialog) *first* so
polish is systemic rather than per-screen.

### 6.3 HIGH (commercial, pre-existing) — VAT is not configured
`tax_rate` has **0 rows**. Your store currently computes zero tax. Greek retail prices
are normally VAT-inclusive (ΦΠΑ 24%), with VAT shown as a breakdown line — but that is
*a decision you have to make*, and Τιμολόγιο (invoice) customers legally need the VAT
line broken out. **This is not caused by the migration**, but the new order schema must
model it correctly from day one rather than inherit the gap. **Needs your answer — see
Open Questions.**

### 6.4 MEDIUM — Auth cutover and password hashes
Medusa stores customer password hashes in `provider_identity` (11 rows, all `emailpass`).
Hashes cannot be re-used across a different hashing scheme.
**Mitigation:** there are only **3 account-holding customers, all test accounts**. Migrate
customer records *without* passwords and require a password reset — or simply re-register.
At this scale this risk is close to zero. It would be severe with 10,000 customers; act now.

### 6.5 MEDIUM — Next.js 16.3 is not the Next.js in anyone's training data
`middleware.ts` is `proxy.ts` here. Other APIs differ too.
**Mitigation:** the repo's own `AGENTS.md` mandates reading
`apps/storefront/node_modules/next/dist/docs/` before writing code. Enforced every phase.

### 6.6 MEDIUM — Supabase connection pooling on serverless
Vercel functions × direct Postgres connections = pool exhaustion.
**Mitigation:** use the Supabase **transaction-mode pooler (port 6543)** for app queries,
session mode (5432) for migrations only; one module-scoped client instance; small pool
per instance; no long transactions.

### 6.7 MEDIUM — CSP breaks images the moment real photos land
`img-src 'self'` today. Supabase Storage is a different origin, and admin-configured hero
images render as CSS `background-image`, bypassing `next/image`.
**Mitigation:** add the Supabase Storage origin to `img-src` in Phase 1, before uploads
exist. Already a known issue in `PROJECT_MEMORY.md` — fix it during, not after.

### 6.8 MEDIUM — Two systems live at once
Running Medusa and the new stack against the same database invites divergent writes.
**Mitigation:** separate `shop` schema; **the new system is read-only against Medusa
tables at all times**; Medusa Admin becomes read-only-by-convention from Phase 7 and is
shut off entirely at Phase 13.

### 6.9 LOW — SEO
All public URLs are derived from `handle`/`slug` and stay identical. Risk is genuinely
low **provided slugs are copied verbatim** and the sitemap/JSON-LD keep working. Since
the site has never been indexed (never deployed), even a slug change would be harmless —
but there's no reason to change any.

### 6.10 LOW — Registration partial-failure bug (existing)
`registerAction` makes 3 sequential Medusa calls with no compensation; a failure at step 2
permanently bricks that email (documented in `PROJECT_MEMORY.md`).
**This bug is deleted by the migration** — one SQL transaction replaces three HTTP calls.

---

## 7. Estimated complexity by feature

Bands, not promises. **S** ≈ under a session · **M** ≈ a session · **L** ≈ 1–2 sessions ·
**XL** ≈ 2–4 sessions. Assumes I do the work with your review at phase boundaries.

| Feature | Complexity | Driver |
|---|---|---|
| Schema + indexes + RLS + DB client | **M** | Design matters most; DDL is fast |
| Catalog read (products/categories) | **M** | 8 functions, exact behaviour parity incl. New Arrivals + price sort |
| Search | **S** | `lib/search.ts` is kept; only the feed changes (and improves) |
| Content/SEO/settings read (8 files) | **S** | One query each, trivial mappings |
| Cart + discounts | **M** | Totals must reconcile exactly with the existing UI |
| Customer auth + account pages | **M** | Backend rewrite, UI untouched |
| **Checkout + orders + inventory + email** | **L** | Transactional correctness, §6.1 |
| Admin shell (nav, layout, primitives, auth) | **L** | Sets the quality bar for everything after |
| Admin dashboard home (metrics) | **M** | Cheap only if the queries are indexed and cached |
| **Admin products (editor + bulk ops)** | **L** | Your §9/§10 — the flagship screen |
| Admin categories/collections/inventory | **M** | |
| Admin orders + detail + status | **M** | |
| Admin customers (GDPR-aware) | **S** | |
| Admin discounts | **S** | |
| **Admin storefront CMS (§13)** | **L** | Homepage/header/footer/SEO — your top-priority feature |
| **Image management (Supabase Storage)** | **M** | Upload, reorder, primary, alt, cleanup |
| Admin settings + users | **S** | |
| Data migration + verification | **M** | Small data, but must be provably correct |
| Medusa removal + cleanup | **S** | Deletion is easy once nothing imports it |
| Security / SEO / performance audits | **M** each | |

**Overall: a substantial but very achievable project — because 85% of the storefront and
100% of the design survive untouched.** The two genuinely large items are checkout
correctness and the admin dashboard.

---

## 8. Proposed custom architecture

### 8.1 Topology — one Next.js app, as you asked

```
apps/web  (single Next.js 16 app, deployed to Vercel)
├── (storefront)   /, /proionta/…, /kalathi, /checkout, /logariasmos …   ← unchanged
├── /admin         the custom dashboard                                   ← new
├── Server Actions + a small number of route handlers                     ← the "API"
└── src/lib/db     server-only SQL layer  ─────────────┐
                                                        ▼
                                    Supabase PostgreSQL (schema: shop)
                                    Supabase Storage (bucket: product-images)
```

**No separate backend service. No Railway. No Render.** This deletes an entire hosting
tier, an entire CORS surface, and — notably — **fixes your current deployment blocker**:
the Vercel site crashes today only because there is no reachable Medusa backend. After
this migration, Vercel + Supabase is a complete, deployable system.

I found no technical reason to split the admin into a second app. Same auth boundary,
same data layer, shared components, and admin routes are trivially excluded from the
sitemap and `robots.txt`.

### 8.2 Database access — direct SQL, **not** `supabase-js` (recommended)

**Recommendation: `postgres` (postgres.js) over the Supabase transaction pooler,
server-side only.**

| | Direct SQL (recommended) | `supabase-js` / PostgREST |
|---|---|---|
| RLS posture | **Unchanged full lockdown; `shop` isn't even exposed to PostgREST** | Must open the Data API + author 30+ policies — *weakens today's posture* |
| Query control | Full — joins, CTEs, window functions, `EXPLAIN` | Constrained by PostgREST semantics |
| Dashboard metrics | One aggregate query | Multiple round trips or RPC wrappers |
| Credentials in browser | None, ever | Anon key ships to the client |
| Dependencies | 1 tiny library | Larger SDK + client bundle weight |
| Fits current code | Everything is already Server Components / Server Actions | Would invite client-side fetching |

Your brief says "do not expose database credentials to the browser" and "all sensitive
database operations must occur server-side" — direct SQL satisfies both by construction.
**Supabase Storage is still used** (§14), via its REST API server-side.

### 8.3 Separate `shop` schema — the key safety decision

Medusa already owns `public.product`, `public.customer`, `public.order`, `public.cart`,
`public.image`, `public.product_category`, `public.seo`, `public.site_setting`,
`public.content_page`, `public.homepage_block`, `public.media_asset`. **Every one of those
names collides with a table the new system needs.**

Putting the new schema in `shop`:
- Zero collisions → both systems coexist safely during phases 2–12.
- Migration is a readable `INSERT INTO shop.product SELECT … FROM public.product`.
- Rollback during any phase is trivial (nothing in `public` was ever written).
- Phase 13 cleanup is a bounded, reviewable drop list.
- PostgREST doesn't expose `shop` by default → stronger than today's lockdown.
- RLS still enabled with zero policies on every `shop` table (defence in depth).

### 8.4 Layering (preserves the pattern that already works)

```
src/lib/db/client.ts        pooled connection, server-only
src/lib/db/<domain>.ts      SQL queries returning DOMAIN types
src/lib/data/*.ts           SAME exported functions as today (thin now)
src/lib/actions/*.ts        Server Actions, unchanged signatures
components/                 untouched
```

Keeping `lib/data/*` exports identical is what makes the component layer a no-op. It is
also the honest way to keep each phase independently shippable.

### 8.5 Authentication

**Two fully separate systems, separate cookies, separate tables.**

- **Customers** — `shop.customer.password_hash` using **`node:crypto` `scrypt`**
  (zero new dependencies, OWASP-acceptable, timing-safe comparison). Sessions are
  **opaque random tokens** in `shop.customer_session`, not JWTs: server-revocable,
  no refresh dance, no secret-rotation footgun. Cookie stays httpOnly/secure/sameSite=lax,
  matching today's `_medusa_jwt` pattern.
- **Admin** — `shop.admin_user` + `shop.admin_session`, a **different cookie name and
  path**, `role` enum (`owner` | `staff`), enforced in `proxy.ts` *and* re-checked in
  every admin Server Action (never rely on the edge check alone).
- **Rate limiting** on login/register/reset — closes a gap `PROJECT_MEMORY.md` already
  flags as missing today.
- CSRF: Next.js Server Actions carry built-in origin checks; admin mutations additionally
  require a same-site session cookie. No third-party CSRF library needed.

*Alternative considered:* Supabase Auth. Rejected because it has **0 users** (nothing to
preserve), it would reintroduce a client-side SDK and a second session mechanism next to
the direct-SQL data path, and it doesn't cover the admin/staff model any better than 40
lines of our own code. Happy to revisit if you want managed social login later.

### 8.6 Order completion (the critical path)

```
BEGIN
  SELECT … FROM shop.cart … FOR UPDATE            -- lock the cart
  validate: email, address, shipping method, non-empty
  re-price every line from shop.product_variant   -- never trust cart snapshots
  re-validate the discount (active, dates, limits)
  UPDATE shop.product_variant SET stock_quantity = stock_quantity - $q
    WHERE id = $id AND stock_quantity >= $q       -- rowcount 0 ⇒ abort
  INSERT shop.order (order_number FROM SEQUENCE, totals incl. VAT)
  INSERT shop.order_item …
  UPDATE shop.cart SET status='completed'
COMMIT
→ then (outside the transaction) send the confirmation email
```

Email is deliberately *after* commit: a SendGrid outage must never roll back a paid order.

### 8.7 Security posture (never weaker than today)

Preserved: nonce CSP, `strict-dynamic`, split `style-src`/`style-src-elem`, security
headers, httpOnly cookies, RLS lockdown, server-only secrets.
Added: `img-src` for Supabase Storage, admin-specific CSP (no analytics on `/admin`),
`X-Robots-Tag: noindex` on `/admin`, rate limiting, admin audit log, per-action
authorization checks, no service-role key ever reaching the browser.

---

## 9. Proposed dashboard architecture

### 9.1 Navigation (adapted to what this store actually has — no filler sections)

```
Πίνακας ελέγχου            /admin
Κατάλογος
  Προϊόντα                 /admin/products         + /new, /[id]
  Κατηγορίες               /admin/categories
  Συλλογές                 /admin/collections
  Απόθεμα                  /admin/inventory
Πωλήσεις
  Παραγγελίες              /admin/orders           + /[id]
  Πελάτες                  /admin/customers        + /[id]
  Εκπτώσεις                /admin/discounts
Κατάστημα (CMS)
  Αρχική                   /admin/content/homepage
  Header & Footer          /admin/content/layout
  Σελίδες περιεχομένου     /admin/content/pages
  Πολυμέσα                 /admin/content/media
  SEO                      /admin/content/seo
Ρυθμίσεις
  Κατάστημα / Αποστολές / Πληρωμές / ΦΠΑ / Αναζήτηση / Analytics / Χρήστες
```

**Deliberately omitted** from your suggested list, because the data doesn't exist and an
empty section is worse than no section: a "Marketing" top-level area (wishlist insights
folds into the product detail page as a real count; marketing consent folds into
Customers), and any analytics beyond the dashboard home.

### 9.2 Design system

Desktop-first, tablet/mobile usable. Reuses the storefront's Tailwind v4 tokens so the
two halves feel like one product.

- **Layout:** fixed 240px sidebar, sticky context header (title + primary action +
  breadcrumb), max-width content column, generous whitespace.
- **Type:** one family, four sizes, three weights. Tabular numerals for money/counts.
- **Colour:** near-monochrome + one accent. Semantic colour *only* for status.
  No decorative gradients.
- **Motion:** 120–160ms opacity/transform only. No page-transition animation.
- **Density:** comfortable default, optional compact table mode.
- **Primitives built once, before any screen:** `DataTable` (sort/filter/paginate/
  bulk-select), `FormField`, `Drawer`, `Modal`, `ConfirmDialog` (typed confirmation for
  destructive bulk ops), `EmptyState`, `Toast`, `StatCard`, `StatusBadge`,
  `ImageUploader`.
- **Charts:** hand-rolled SVG sparklines/bars. **No charting library** — keeps the bundle
  small and matches your "no large libraries" rule.
- **Every table row is a link; every list has a real empty state; every destructive action
  needs confirmation; every mutation gives an optimistic-but-verified toast.**

### 9.3 Performance rules for the dashboard

- Server Components by default; client only for genuinely interactive widgets.
- Dashboard metrics: **one** aggregate SQL query, `revalidate: 300`, backed by indexes on
  `order(created_at)`, `order(status)`, `product_variant(stock_quantity)`.
- Lists: keyset/offset pagination with `LIMIT`, never "fetch all then filter".
- `/admin` is excluded from `sitemap.ts`, `robots.txt`, and analytics injection.
- Admin JS never ships to storefront routes (separate route segment ⇒ separate bundle).

### 9.4 Product editor (§9 of your brief) — the flagship screen

Single page, two columns, autosave-on-blur with an explicit dirty indicator:
- **Left:** title, slug (auto from title, manually overridable, with a "changing this
  breaks existing links" warning), SKU, description, specifications (typed key/value
  rows mapped to real columns: material, weight, dimensions, origin).
- **Right rail:** status toggle, price + sale price with **live-computed discount %**,
  stock with quick +/− , category, collections, "New" override, SEO panel (title,
  description, OG image, robots), image manager (drag-reorder, set primary, alt text).
- Keyboard: `⌘S` save, `⌘K` command palette (jump to any product/order/customer).
- The list view supports bulk select → activate/deactivate, set category/collection,
  adjust price by % or fixed amount, set stock, archive — each behind a typed confirm
  dialog showing exactly how many rows will change.

---

## 10. Proposed database architecture (~22 tables vs. Medusa's 152)

All in schema `shop`. Money as **integer cents** (`price_cents int`) — never floats.
`created_at`/`updated_at timestamptz` everywhere. RLS enabled, zero policies, on all.

**Catalog**
| Table | Key columns |
|---|---|
| `product` | `id`, `slug` (uniq), `title`, `description`, `category_id`, `is_active`, `is_new_override`, `vat_rate` (nullable override), `material`, `weight_grams`, `length_cm`, `width_cm`, `height_cm`, `origin_country`, `hide_from_search`, `is_search_boosted`, `badge_label`, `warranty_text`, `sort_order`, timestamps |
| `product_option` | `id`, `product_id`, `name` ("Μέγεθος"), `position` — real variants (decision 2) |
| `product_option_value` | `id`, `option_id`, `value` ("28cm"), `position` |
| `product_variant` | `id`, `product_id`, `sku` (uniq), `title`, `price_cents` (**VAT-inclusive**), `compare_at_price_cents`, `stock_quantity`, `allow_backorder`, `position` — **every product has ≥1 variant** (single-variant products get a default one) |
| `product_variant_option_value` | `variant_id`, `option_value_id` (composite PK) — which option combination this variant is |
| `product_image` | `id`, `product_id`, `storage_path`, `alt_text`, `position`, `is_primary` |
| `category` | `id`, `slug` (uniq), `name`, `description`, `parent_id`, `image_path`, `sort_order`, `is_active` |
| `collection` | `id`, `slug` (uniq), `title`, `description`, `image_path`, `is_active` |
| `product_collection` | `product_id`, `collection_id` (composite PK) |

**Commerce**
| Table | Key columns |
|---|---|
| `cart` | `id`, `customer_id?`, `email`, `status`, shipping/billing address (jsonb), `shipping_method_id`, `discount_id`, `tax_document_type`, `invoice_details` (jsonb), `expires_at` |
| `cart_item` | `id`, `cart_id`, `variant_id`, `quantity`, snapshotted `title`/`sku`/`unit_price_cents`/`compare_at_price_cents`/`product_slug` |
| `order` | `id`, `order_number` (from SEQUENCE, uniq), `customer_id?`, `email`, `status`, `payment_status`, `fulfillment_status`, `subtotal_cents`, `discount_cents`, `shipping_cents`, `vat_cents`, `total_cents`, addresses (jsonb), `shipping_method_name`, `payment_method`, `tax_document_type`, `invoice_details` (jsonb), `notes`, timestamps |
| `order_item` | `id`, `order_id`, `variant_id?`, snapshotted title/sku/qty/unit price/line total |
| `order_event` | `id`, `order_id`, `type`, `from_status`, `to_status`, `note`, `admin_user_id?`, `created_at` — the status-history timeline |
| `discount` | `id`, `code` (uniq, case-insensitive), `type` (percentage/fixed), `value`, `min_subtotal_cents`, `starts_at`, `ends_at`, `max_redemptions`, `redemption_count`, `is_active` |
| `discount_redemption` | `id`, `discount_id`, `order_id`, `customer_id?` |
| `shipping_method` | `id`, `name`, `price_cents`, `free_over_cents`, `is_pickup`, `is_active`, `sort_order` |
| `inventory_movement` | `id`, `variant_id`, `delta`, `reason`, `order_id?`, `admin_user_id?` — audit trail for §6.1 debugging |

**Customers & admin**
| Table | Key columns |
|---|---|
| `customer` | `id`, `email` (uniq, citext-style lower index), `password_hash?` (null ⇒ guest), `first_name`, `last_name`, `phone`, `marketing_consent`, `is_active`, timestamps |
| `customer_address` | `id`, `customer_id`, label, name, `address_1`, `address_2`, `city`, `postal_code`, `country_code`, `phone`, `is_default_shipping` |
| `customer_session` | `token_hash` (PK), `customer_id`, `expires_at`, `created_at` |
| `password_reset_token` | `token_hash` (PK), `customer_id`, `expires_at`, `used_at` |
| `wishlist_item` | `customer_id`, `product_id`, `created_at` (composite PK) — enables the account sync currently missing |
| `admin_user` | `id`, `email` (uniq), `password_hash`, `name`, `role`, `is_active`, `last_login_at` |
| `admin_session` | `token_hash` (PK), `admin_user_id`, `expires_at` |
| `admin_audit_log` | `id`, `admin_user_id`, `action`, `entity_type`, `entity_id`, `diff` (jsonb), `created_at` |

**Content / CMS**
| Table | Key columns |
|---|---|
| `site_setting` | singleton — tagline, contact, hours, socials, announcement, cart message, **logo, store name, free-shipping threshold, `default_vat_rate` (24)** |
| `homepage_block` | `kind` (hero/promo), eyebrow, heading, body, cta label/href, `image_path`, `sort_order`, `is_published` |
| `content_page` | `slug` (uniq), `title`, `body`, `is_published` |
| `nav_item` | `id`, `parent_id`, `label`, `href`, `sort_order`, `location` (header/footer), `is_active` — makes navigation editable, which it isn't today |
| `media_asset` | `id`, `storage_path`, `label`, `alt_text`, `width`, `height`, `bytes` — **real files now** |
| `seo_meta` | `resource_type`, `resource_id` (uniq together), title, description, canonical, OG fields, `social_image_path`, keywords, robots |
| `search_synonym` | `id`, `terms` |
| `analytics_setting` | singleton — GA4/GTM/Pixel/Clarity IDs |
| `promo_banner` | singleton — headline, body, cta, `ends_at`, `is_published` |

**Indexes to create up front:** `product(slug)`, `product(category_id, is_active)`,
`product(is_active, created_at DESC)`, `product_variant(product_id)`,
`product_variant(sku)`, `product_variant(stock_quantity)` partial `WHERE stock_quantity <= 5`,
`category(parent_id, sort_order)`, `cart(expires_at)`, `order(created_at DESC)`,
`order(status)`, `order(customer_id)`, `order_item(order_id)`, `lower(customer.email)`,
`discount(lower(code))`, `product_collection(collection_id)`.

**Deliberately NOT modelled:** regions, currencies beyond EUR, sales channels, stock
locations, price sets/rules/lists, tax rules engine, returns, exchanges, claims,
credit lines, campaigns, RBAC tables, workflow executions. All of it is Medusa
generality you do not use.

---

## 11. Proposed migration phases

Each phase ends with `tsc` + `eslint` + `next build` clean, live browser verification,
one focused commit, and updated docs. **Storefront stays fully working after every
phase.** Branch: `custom-dashboard-migration` (created on approval, never pushed without
asking).

| Phase | Name | Ships | Medusa still needed? |
|---|---|---|---|
| **0** | **Audit** | This document | — |
| 1 | Foundation | Backup + export, `shop` schema DDL + indexes + RLS, DB client, CSP/`img-src` prep | yes |
| 2 | Catalog read | `data/products.ts`, `data/categories.ts` on SQL. **Storefront browsing no longer touches Medusa** | partially |
| 3 | Content & SEO read | 8 CMS data files on SQL. **7 custom Medusa modules become dead** | partially |
| 4 | Cart & discounts | Cart engine, coupons, totals | partially |
| 5 | Customer auth | Register/login/session/reset, account pages | partially |
| 6 | **Checkout, orders, inventory, email** | Transactional completion incl. **ΦΠΑ 24% breakdown**, SendGrid from Next.js. **Storefront is 100% Medusa-free** | **no** |
| 6b | Storefront variants + collections | PDP variant selector, listing price ranges, `/syllogi/[slug]` routes + SEO (decisions 2 & 3) | no |
| 7 | Admin foundation | Auth, shell, nav, primitives, dashboard home | no |
| 8 | Admin catalog | Products (editor + bulk), categories, collections, inventory, **image upload** | no |
| 9 | Admin sales | Orders + detail + status, customers, discounts | no |
| 10 | Admin CMS | Homepage, header/footer/nav, pages, media, SEO | no |
| 11 | Admin settings | Store, shipping, payment, VAT, search, analytics, admin users | no |
| 12 | Data migration & verification | Real catalog + CMS into `shop`, count/field assertions, side-by-side check | no |
| 13 | **Remove Medusa** | Delete `apps/backend`, deps, env vars, `lib/medusa.ts`, drop Medusa tables | — |
| 14 | Security audit | Authz matrix, rate limits, RLS re-verify, secret audit, CSP re-verify on a **production build** | — |
| 15 | SEO audit | Metadata/canonical/sitemap/JSON-LD parity, redirects if any slug moved | — |
| 16 | Performance audit | Query plans, N+1 sweep, bundle size, first real Lighthouse run | — |
| 17 | Final cleanup | Dead code, unused deps, docs (`PROJECT_MEMORY`/`MIGRATION_PLAN`/`CHANGELOG`) | — |

**Phase 6 is the milestone that matters:** at that point the storefront is entirely
independent of Medusa, and Medusa survives only as the admin UI until Phase 11.

---

## 12. Data migration strategy

### 12.1 Backup before anything (Phase 1, gate — nothing proceeds without it)

1. **You**: take a manual backup/snapshot in the Supabase dashboard (Database → Backups).
   I cannot trigger this, and it is the real safety net.
2. **Me**: a full JSON export of every non-empty `public` table into `backups/`, written
   with the read-only client already built for this audit.
3. **Me**: `SCHEMA_SNAPSHOT.md` — table list, row counts, constraints, indexes as of today.

### 12.2 Documented baseline (already captured, §3.1)

16 products · 28 categories · 36 variants/SKUs · 42 EUR prices · 3 sale prices ·
36 inventory levels · 7 customers · 4 orders · 4 discount codes · 6 CMS rows.
Phase 12 asserts against these exact numbers.

### 12.3 Migration mechanics

Both schemas live in the same database, so migration is plain SQL in one transaction —
no ETL tooling, no intermediate files, no second database:

```sql
BEGIN;
INSERT INTO shop.category (slug, name, description, parent_id, sort_order, is_active)
SELECT handle, name, description, /* mapped parent */, rank, is_active
FROM public.product_category
WHERE deleted_at IS NULL
  AND handle NOT IN ('shirts','pants','sweatshirts','merch');   -- demo data
-- …products, variants (price from price_set→price, sale from price_list),
--   inventory, categories link, CMS singletons…
COMMIT;
```

Order: categories (parents → children) → collections → products → variants → prices →
stock → CMS singletons → SEO → customers (no passwords) → discounts.

### 12.4 Verification before Medusa is touched (Phase 12 exit gate)

- Row-count assertions against §12.2 for every entity.
- Field-level diff: every product's slug, title, SKU, price cents, sale price, stock,
  category path — compared programmatically, not by eye.
- Every one of the 16 product URLs and 28 category URLs renders identically old vs new.
- Cart → checkout → order completes end-to-end in the browser.
- **Only then** does Phase 13 delete anything.

### 12.5 Data deliberately not migrated

| Data | Rows | Why |
|---|---|---|
| Demo products | 4 | Medusa seed, already soft-deleted |
| Demo categories | 4 | Medusa seed |
| USD prices | 22 | Single-currency EUR store |
| Region + country rows | 251 | Greece only |
| "Test Sale" price lists | 3 | Test data |
| Test promo codes | 4 | `TESTCART10` etc. — recreate real ones in the new admin |
| Test orders | 4 | Development artifacts, all `pending`. **Exported to JSON, not imported** |
| Customer password hashes | 11 | Different hashing scheme (§6.4) |
| `qa-agent` admin users | 6 | Your own `TASKS.md` says delete them |
| Medusa infrastructure | 100+ tables | Migrations, workflows, API keys, sales channels, price sets, order summaries, RBAC… |

---

## 13. How we minimise debris

1. **`shop` schema** → cleanup is a bounded, reviewable list, not archaeology.
2. **Stable `lib/data/*` exports** → no adapter/shim layer ever exists, so none needs
   removing later. There is no "compatibility mode."
3. **Delete `apps/backend` wholesale in Phase 13** — 4,682 LOC + 500+ files of `.medusa`
   build artifacts + `.turbo` + nested `pnpm-workspace.yaml`/`turbo.json`/`railway.json`/
   `render.yaml`, in one commit.
4. **Repo flattens**: nested Turborepo-inside-a-pnpm-workspace collapses to one app.
   `pnpm-workspace.yaml`'s `!apps/backend` exclusion disappears with it.
5. **Minimal new dependencies — target 1, maximum 2**: `postgres` (postgres.js) for SQL;
   optionally `zod` for admin form validation. Auth uses `node:crypto`, charts are
   hand-written SVG, image transforms use `next/image`. **No ORM, no UI kit, no chart
   library, no auth library.**
6. **Env vars shrink** from 14 to ~7.
7. **Phase 13 checklist** grepping for every one of: `medusa`, `MEDUSA`, `@medusajs`,
   `publishable`, `region_id`, `variant_id` (where Medusa-shaped) — must return zero
   hits outside `CHANGELOG.md`'s history.
8. **`lib/types.ts` comments** (11 Medusa mentions) rewritten to describe the real schema,
   so the code reads as if designed this way from the start.
9. **Docs consolidated**: 14 root `.md` files (10,673 lines) → `PROJECT_MEMORY.md`,
   `MIGRATION_PLAN.md`, `CHANGELOG.md`, `ADMIN_GUIDE.md`, and the specs folded into the
   first. Proposed in Phase 17, subject to your approval.

**Exit test:** a new engineer reading the final repo should find no evidence Medusa ever
existed, except in `CHANGELOG.md`'s history where it belongs.

---

## 14. What should NOT be migrated

**Medusa concepts to drop entirely** (not "port later" — drop):
regions & multi-currency · sales channels · stock locations & fulfillment providers ·
price sets / price rules / price lists · the tax rules engine · publishable API keys ·
payment collections & payment sessions (COD needs none) · returns, exchanges, claims,
credit lines, captures · campaigns & campaign budgets · workflow engine & subscribers ·
module links · MFA & RBAC tables · product options/option-values machinery (your real
catalog is single-variant) · the Medusa Admin SPA · the `store-pickup` fulfillment
provider (becomes one row in `shipping_method`).

**Code/config not to carry over:**
`apps/backend/**` in its entirety · `railway.json` · `render.yaml` (uncommitted) ·
`turbo.json` · the nested `pnpm-workspace.yaml` · `@medusajs/eslint-plugin` ·
`instrumentation.ts` · `integration-tests/` (a stub) · `jest.config.js` (no tests exist) ·
`apps/backend/apps/backend/static/` (uncommitted, one stray screenshot) ·
`initial-data-seed.ts` · all 12 Medusa module migration files + snapshots.

**Behaviour NOT to reproduce:**
- The `getDefaultRegionId()` call preceding **every** catalog query — an entire HTTP
  round trip to answer "we sell in euros."
- Client-side price sorting over a 200-row fetch — becomes `ORDER BY price_cents`.
- Fetching 1,000 products with all fields to run search — becomes one indexed query.
- The 3-call registration sequence with no compensation (§6.10).
- Storing tax-document (ΑΦΜ/ΔΟΥ) data in a generic `metadata` JSON blob because the core
  model had no field for it — these become **real typed columns**.

**Explicitly not in scope unless you ask:** Stripe/card payments (still awaiting your
API keys), multi-language, multi-currency, reviews/ratings (correctly refused before —
no fake trust signals), a newsletter provider, B2B pricing, returns/RMA.

---

## 15. Recommended final folder structure

```
eshop7777/
├── PROJECT_MEMORY.md          architecture of record
├── MIGRATION_PLAN.md          living phase tracker
├── CHANGELOG.md               history (only place "Medusa" survives)
├── ADMIN_GUIDE.md             how to run the store
├── package.json               single app, no workspace indirection
└── apps/web/
    ├── .env.example           ~7 vars
    ├── next.config.ts
    ├── db/
    │   ├── migrations/        0001_init.sql, 0002_… (plain, numbered, forward-only)
    │   └── seed/
    └── src/
        ├── proxy.ts                       CSP + admin route guard
        ├── app/
        │   ├── (storefront)/              ← every existing route, unchanged
        │   │   ├── page.tsx  [category]/  proionta/  kalathi/  checkout/
        │   │   ├── logariasmos/  anazitisi/  lista-epithymion/  …
        │   │   ├── sitemap.ts  robots.ts  not-found.tsx  error.tsx   ← the two gaps, finally filled
        │   └── admin/
        │       ├── layout.tsx  page.tsx
        │       ├── products/  categories/  collections/  inventory/
        │       ├── orders/  customers/  discounts/
        │       ├── content/{homepage,layout,pages,media,seo}/
        │       ├── settings/
        │       └── login/
        ├── components/
        │   ├── (all existing folders unchanged: home, layout, product,
        │   │   category, cart, checkout, account, wishlist, content, ui)
        │   └── admin/         shell/  table/  form/  media/  charts/
        └── lib/
            ├── db/            client.ts + one module per domain (SQL lives here)
            ├── data/          SAME exported API as today
            ├── actions/       storefront Server Actions (same signatures)
            ├── admin/         admin-only actions, auth, authorization, audit
            ├── auth/          hashing, sessions, rate limiting
            ├── storage/       Supabase Storage upload/delete/URL
            ├── email/         SendGrid templates + send
            ├── search.ts      ← unchanged
            ├── types.ts       ← unchanged (comments rewritten)
            └── (format, site-config, validation, *-storage … unchanged)
```

`apps/storefront` → `apps/web` is the only rename, and only because it stops being just
a storefront. Say the word and it stays as-is.

---

## Decisions — locked 2026-08-13

| # | Decision | Source |
|---|---|---|
| 1 | **ΦΠΑ 24%, VAT-inclusive pricing** | You (rate) + Greek B2C law (mode) |
| 2 | **Real variants** — one product, many sizes/options | You |
| 3 | **Collections built fully**, storefront + admin | You |
| 4 | **4 test orders are development artifacts** — exported to JSON, not migrated | You |
| 5 | **Keep `apps/storefront`** — no rename | Me (see below) |
| 6 | **Adopt `zod`, server-side only** | Me (see below) |

### 1. VAT — inclusive, 24%

You gave the rate; the mode follows from Greek/EU B2C consumer law rather than
preference: **displayed retail prices to consumers must include VAT.** So:

- `price_cents` on `product_variant` is the **VAT-inclusive** price the customer sees.
- `order.vat_cents` is a derived breakdown line: `round(total_incl × 24 ÷ 124)`.
- Storefront shows "Στην τιμή περιλαμβάνεται ΦΠΑ 24%"; Τιμολόγιο (invoice) orders and
  the order confirmation email break the VAT line out explicitly.
- Schema carries `site_setting.default_vat_rate` (24) plus a nullable
  `product.vat_rate` override — one column of insurance in case a future product falls
  under Greece's reduced 13%/6% bands. All current housewares are standard-rate.

If you actually meant VAT-exclusive (B2B-style, tax added at checkout), say so now — it
changes the schema and every price display, and is much cheaper to change before Phase 1
than after.

### 2. Real variants — scope impact (this grew the plan)

The storefront's variant support today is **a bare radio-button list** in
`AddToCartButton.tsx`, deliberately minimal and — by its own code comment — never
designed or verified against real multi-variant data, because none exists. "Real
variants" therefore means new work in three places, not just the admin:

- **PDP** — a properly designed variant selector: per-variant price, per-variant stock,
  SKU that updates with selection, out-of-stock options visibly disabled rather than
  missing.
- **ProductCard / listings** — `Product.price` stops being a single number. Listings need
  a range ("από 24,90 €") when variants differ in price. This touches `lib/types.ts`,
  `toDomainProduct`, and the card — the first genuine component change in this migration.
- **Admin** — a variant matrix editor (option names → values → generated rows, each with
  its own SKU, price, sale price, stock). This is the largest single addition to Phase 8.

**What I will not do automatically:** merge your existing products. Consolidating
"Αντικολλητικό τηγάνι 28" and its siblings into one product with three variants changes
URLs and retires SKUs — that is a content decision for you, made in the new admin after
migration. Phase 12 migrates each existing product with exactly one default variant, so
nothing changes underfoot.

### 3. Collections — scope impact

`product_collection` is empty and **no collection route exists on the storefront** — no
`/syllogi/[slug]`, nothing in the nav, nothing in the sitemap. "Fully" therefore means
genuinely new storefront surface, not just an admin screen:

- New route + PLP (reusing the existing category PLP components — sort, infinite scroll,
  breadcrumbs all come free), collection SEO + JSON-LD, sitemap entries, optional nav/
  mega-menu placement, and homepage collection rails.
- Admin: collection CRUD, image, SEO, and product assignment (including from the bulk
  actions in §10 of your brief).

### 5. Folder rename — keeping `apps/storefront`

Renaming to `apps/web` is cosmetic, and it is not free: Vercel's Root Directory is set to
`apps/storefront` and getting that wrong already cost you one real build failure, plus
`.claude/launch.json` and every doc path would need updating. Churn without benefit —
**keeping the current name.** Trivial to revisit later if it bothers you.

### 6. `zod` — yes, server-side only

The admin adds roughly 30 forms and well over 100 fields writing straight to the database.
Hand-rolled validators are fine for the storefront's six forms (`checkout-validation.ts`
is genuinely clean) but that approach doesn't scale to the admin without becoming the
place bugs hide. `zod` is small, validates **inside Server Actions**, so it never reaches
the browser bundle — zero client-side cost. That brings total new dependencies to **two**
(`postgres`, `zod`), still well inside the minimal-debris goal.

### Revised complexity after decisions 2 and 3

| Phase | Was | Now | Why |
|---|---|---|---|
| 2 — Catalog read | M | **M+** | Price ranges, variant-aware listings |
| 8 — Admin catalog | L | **L+** | Variant matrix editor, collection CRUD |
| New — storefront variants + collections surface | — | **M** | PDP selector, card price ranges, `/syllogi` routes |

Everything else in §7 is unchanged.

---

## Recommendation

**Do it, and do it now.** The three things that usually make this kind of migration
dangerous — real customers, real orders, real traffic — are all absent, and the storefront
is already better decoupled from Medusa than most projects ever manage. You are replacing
152 tables with ~22, two hosting tiers with one, and ~4,700 LOC of backend plumbing with
SQL you control.

Two honest cautions. First, the admin dashboard is a real product, not a weekend — Phases
7–11 are the bulk of the work, and the quality bar you've set is what makes it so. Second,
Phase 6 (order completion) is the one place where "roughly right" isn't good enough, and
I intend to spend disproportionate care there.

**Nothing has been changed. No branch created, no dependencies installed, no database
writes, no files in the app touched.** Awaiting your approval and your answers to the six
questions above.
