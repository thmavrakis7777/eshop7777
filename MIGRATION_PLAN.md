# Migration Plan & Status — Medusa → custom Next.js + Supabase

**Read this first if you are a new session.** It is the single source of truth
for where the migration stands. `MIGRATION_AUDIT.md` holds the original
analysis and the locked decisions; this file holds progress and what is next.

Branch: `custom-dashboard-migration`. **Nothing has been pushed** — every phase
is committed locally only, per the project's standing instruction.

---

## Where things stand

| Phase | Status | Commit |
|---|---|---|
| 0 — Audit | ✅ | `de47085` |
| 1 — Foundation (backup, `shop` schema, DB client) | ✅ | `de47085` |
| 2 — Catalog reads on SQL | ✅ | `25477f8` |
| 3 — CMS / SEO / settings reads on SQL | ✅ | `4f12210` |
| 4 — Cart & discounts | ✅ | `d37f154` |
| 5 — Customer auth | ✅ | `dc08d29` |
| 6 — Checkout, orders, inventory | ✅ | `ce384e2` |
| 7 — Admin foundation | ✅ | `8acc25f` |
| 8 — Admin catalog | ✅ | `3a8cf74`, `de3b2b2` |
| 9 — Orders, customers, discounts | ✅ | `e18a5da` |
| 10 — Storefront CMS | ✅ | `903ccde` |
| 11 — Settings & admin users | ✅ | `5d9c3d2` |
| 6b — Storefront variants + collections | ✅ | — |
| 12 — Data migration & verification | ✅ | — |
| 13 — Remove Medusa | ✅ | — |
| 14 — Security audit | ✅ | — |
| 15 — SEO audit | ✅ | — |
| 16 — Performance audit | ✅ | — |
| 17 — Final cleanup & docs | ✅ | — |

**All 17 phases are complete (2026-08-17).** The storefront and admin are
both fully functional on Postgres, Medusa is completely gone — code deleted
from the repo, tables dropped from the database (both 2026-08-16) —
everything the app needs lives in the `shop` schema, and security/SEO/
performance audits have all run with real fixes applied and live-verified.
Two things remain genuinely open, not part of this migration's own scope:
image upload (blocked on Supabase Storage credentials — see below) and the
DB pooler-mode question flagged in Phase 16 (needs Supabase dashboard
access). Nothing has been pushed to `origin/main` yet — see the top of this
file.

---

## Architecture as built

```
apps/storefront  (one Next.js 16 app, the only app that matters now)
├── src/app/(storefront)/…   the shop — unchanged URLs
├── src/app/admin/…          the admin dashboard
│   ├── login/               outside the session gate
│   └── (protected)/         everything else; layout enforces auth
├── src/lib/db/              SQL (server-only) — catalog, cart, checkout,
│                            customer, orders, content
├── src/lib/admin/           admin queries + Server Actions
├── src/lib/auth/            scrypt password hashing, opaque sessions
└── db/                      migrations + operational scripts
        ▼
Supabase Postgres — schema `shop` (37 tables)
```

- **Direct SQL via `postgres` (postgres.js)**, not `supabase-js`. Everything is
  server-side; opening PostgREST would have meant authoring 30+ RLS policies
  and weakening the existing lockdown.
- **`shop` schema** keeps the new tables away from Medusa's `public` ones,
  every name of which collides. RLS is enabled with zero policies on all 37,
  enforced and repaired on every migration run.
- Money is **integer cents**; prices are **VAT-inclusive** (ΦΠΑ 24%), with
  `vat_cents` derived as a breakdown line, never added on top.

### Dependencies added (3)
`postgres`, `zod`, `server-only`. No ORM, no UI kit, no chart library, no auth
library.

---

## Operational commands

```bash
cd apps/storefront

pnpm db:migrate            # apply pending SQL migrations + enforce RLS
pnpm db:status             # what is applied vs pending
pnpm db:test-concurrency   # proves order completion cannot oversell
pnpm typecheck && pnpm lint && pnpm build

node db/create-admin.mjs <email> <password> "<name>" owner
node db/seed-test-order.mjs create|remove
node ../../scripts/db/export-backup.mjs   # full JSON backup → gitignored backups/
```

Admin: `http://localhost:3000/admin/login` — owner account is
`th.mavrakis@gmail.com`. **The password was reset 2026-08-16 (via
`db/create-admin.mjs`, to verify Phase 6b through the real admin UI) to a
known temporary value handed to the owner in chat; the owner still intends to
change it via `/admin/settings`.**

---

## Live data (verified, all test data removed)

16 products · 28 categories · 0 collections · 16 variants (every real product
has exactly one — the earlier "36 variants" figure in this file was stale/
wrong, confirmed 2026-08-16 by querying both `shop.product_variant` and
Medusa's original `public.product_variant`: neither ever had a real
multi-variant product) · 7 customers · 0 orders · 0 discounts · 1 admin ·
3 shipping methods · stock all 100.

**Medusa's 152 `public` tables are gone** (dropped 2026-08-16, after a fresh
backup — `backups/2026-08-16T19-57-53/`, gitignored — and a field-level
verification against `shop` found zero real mismatches). If a genuinely
missing field ever surfaces later, that backup is the only remaining source
for Medusa's original data — the live database no longer has it.

---

## What is NOT done — start here

### 1. Phase 6b — storefront variants + collections (decisions 2 and 3) — DONE, with a scope note
Completed 2026-08-16. Built: `Product.priceRange` (`lib/types.ts`,
`toDomainProduct` in `lib/db/catalog.ts`) rendering "από X €" on `ProductCard`
and the PDP plus an `AggregateOffer` JSON-LD fallback when it's set; the full
`/syllogi/[slug]` storefront route (catalog queries, `ProductSource` union +
load-more action, SEO via the existing `getSeoOverride("collection", …)`,
sitemap entries) — all verified live against a temporary real collection +
variant, created via the admin UI and reverted after.

**Deliberately not built**: the option-grouped variant selector redesign
(swatches/size chips grouped by option type). `shop.product_option` /
`product_option_value` / `product_variant_option_value` exist in the schema
for this but are and have always been empty — Medusa's own original source
data never had a real multi-variant STIA product either (confirmed live,
2026-08-16), only its unrelated demo seed data (`SHIRT-S-BLACK` etc., already
excluded from migration per `MIGRATION_AUDIT.md` §12.5). Building a grouped
option UI now would mean verifying it against fabricated structure with
nothing real behind it — the existing flat radio list (`AddToCartButton.tsx`)
already works correctly for any number of variants, just isn't pretty. Revisit
once a real multi-option product exists, or if the owner wants to invest in it
speculatively anyway.

### 2. Image upload (blocked on credentials)
Everything else in the admin works; images do not. Needs two values in
`apps/storefront/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```
`lib/storage/urls.ts` already derives public URLs from a stored path.
`lib/admin/cms.ts` has `isStorageConfigured()`. The admin says so honestly
rather than showing a dead button. Once set: upload, reorder, alt text,
primary selection for products, hero blocks and category images.

### 3. Phase 13 — remove Medusa — DONE (2026-08-16)
**Code**: `apps/backend/` (132 tracked files + all its untracked
`.medusa`/`node_modules` build artifacts) deleted from both git and disk.
Removed `NEXT_PUBLIC_MEDUSA_*` from `next.config.ts`/`.env.example`
(`next.config.ts`'s image `remotePatterns` now derives from
`NEXT_PUBLIC_SUPABASE_URL` instead — was pointed at Medusa's static file
host, now ready for the still-pending image-upload feature above), removed
the nested-workspace exclusion from `pnpm-workspace.yaml`, removed the
`backend` entry from `.claude/launch.json` and deleted
`.claude/dev-backend.cmd`, rewrote `DEPLOYMENT.md` for the real
Vercel-only-plus-Supabase architecture (no more Railway/Render section — no
second service to deploy). `railway.json`/`render.yaml` never existed at
repo root — only inside the now-deleted `apps/backend/`, gone with it.

**Database**: fresh backup taken first (`backups/2026-08-16T19-57-53/`,
gitignored, 89 non-empty tables / 1,443 rows), then a field-level
verification — re-ran `db/import-from-medusa.mjs` one last time (zero
warnings, every row matched) plus a direct title/price/category/customer
diff between `public` and `shop` (zero real mismatches) — then all 152
tables in the `public` schema were dropped in a single transaction, with the
owner's explicit go-ahead on that specific step. `shop` schema counts
confirmed unchanged before/after (16 products, 28 categories, 7 customers).
`db/import-from-medusa.mjs` itself is deleted too — its only job was reading
`public`, which no longer exists.

`tsc`/`eslint`/`next build` all clean throughout; live-verified the
homepage, a product/category page, and the admin dashboard all render
correctly after both the code removal and the table drop.

### 4. Phase 14 — security audit — DONE (2026-08-16)
Full audit of auth, authorization/RLS, injection surfaces, XSS, secrets,
session/cookie mechanics, rate limiting, and dependencies. Checked clean, no
action needed: password hashing (scrypt, correct params), session revocation
(real server-side delete, not just cookie clearing), RLS on all `shop`
tables, admin action auth (all 40 exported admin Server Actions call
`requireAdmin()`/`requireOwner()` first — full census, not a sample), SQL
injection (zero raw interpolation anywhere — exhaustive grep), IDOR in cart/
checkout/address-book/order-list, secrets never reaching the client bundle,
CSRF posture (Next's same-origin Server Action enforcement, `SameSite=Lax`,
`form-action 'self'`).

**Fixed:**
- **Stored XSS via analytics settings** (medium-high) — `ga4MeasurementId`/
  `gtmContainerId`/`metaPixelId`/`clarityProjectId` were saved with zero
  validation and interpolated raw into executing, CSP-nonce'd inline
  `<script>` tags (`AnalyticsScripts.tsx`). Any `staff`-role admin could store
  a value that breaks out of the string literal and runs arbitrary JS on
  every consenting storefront visitor. Fixed with two layers: format
  validation on save (`settings-actions.ts`'s `TRACKING_ID` regex — real IDs
  are alphanumeric plus hyphens, anything else is rejected outright) and
  `JSON.stringify` escaping at the render site regardless. Live-verified: a
  breakout payload is now rejected with a clear error; a real-shaped ID still
  saves and activates correctly.
- **Order detail accessible by uuid alone, even for logged-in customers'
  orders** (medium) — the guest-checkout "uuid is the access token" model
  was also being used, unchanged, for the account dashboard's order-detail
  view. A customer-owned order (unlike a guest one) persists indefinitely, no
  expiry, more complete PII (address, ΑΦΜ) — so `getOrderById` now returns
  `null` (indistinguishable from "no such order") unless the viewer's own
  session matches the order's `customer_id`; guest orders (`customer_id`
  null) are unaffected. Live-verified end-to-end with a real temporary test
  order and a throwaway test customer: owner access works, unauthenticated
  access is now blocked — both reverted after.
- **No rate limiting on billable/enumerable unauthenticated actions** —
  Google Places autocomplete + place-details and the ΓΕΜΗ ΑΦΜ lookup (both
  billable third-party calls) and promo-code apply (enumeration risk) had
  none. Added, reusing the existing Postgres-backed `checkRateLimit`
  (extracted the duplicated `rateLimitKey` IP-derivation helper into
  `lib/auth/session.ts` rather than triplicating it further).
- **`nanoid` <3.3.18** (`pnpm audit`'s one high finding, GHSA-2v37-7h3g-55p8) —
  transitive via postcss, not reachable from application code, but a free
  fix: pinned via `overrides` in `pnpm-workspace.yaml`. `pnpm audit` now
  clean.
- Two low-severity hardening fixes: JSON-LD `<script>` tags now escape `<` to
  block a `</script>` breakout via an admin-authored `structuredDataOverride`
  (`lib/json-ld.ts`, shared by all three JSON-LD call sites); a client-supplied
  `placeId` is now `encodeURIComponent`-ed before being interpolated into the
  Google Places URL path (was already done for `sessionToken` on the same
  line, just missed for `placeId`).
- `pruneExpiredAuthRows()` existed but was never called anywhere — expired
  session/token/rate-limit rows accumulated forever (not a vulnerability,
  every read already filters by expiry, but unbounded growth). Wired up as a
  1%-probability fire-and-forget call from inside `checkRateLimit`, the most
  frequently-hit auth code path — there's no cron in this deployment target.
- Verified live (not just read) that an unauthenticated request to a
  `/admin/(protected)/*` page returns a clean redirect with zero page body —
  no admin data ever reaches an unauthenticated response, regardless of
  Next's internal parallel-render scheduling.

**Policy call, resolved**: site-wide settings (VAT rate, free-shipping
threshold, shipping method prices, analytics config) were gated to
`requireAdmin()` (any admin) — the owner decided these should be
owner-only, since they're revenue-affecting and store-wide, same tier as
the admin-account-management actions. Moved to `requireOwner()`:
`saveSiteSettingsAction` (`cms-actions.ts`), `saveShippingMethodAction`/
`deleteShippingMethodAction`/`saveAnalyticsAction` (`settings-actions.ts`).
The three admin pages that render these forms (`content/layout` — only its
site-settings section, the promo banner on the same page stays
`requireAdmin`; `settings/shipping`; `settings/analytics`) now show a
"owners only" explanation instead of a form a `staff` account would only
have rejected, mirroring the existing pattern in `settings/users/page.tsx`.
Live-verified by temporarily downgrading the current session to `staff`:
all three correctly showed the restriction (with the layout page's promo
banner still editable) and reverted to the full form once restored to
`owner`.

**Also unresolved, low severity, left as-is**: the rate limiter fails open
on a database error (deliberate, documented trade-off — availability over
strictness for a login throttle) and keys on the spoofable
`x-forwarded-for` header (a throttle, not an access control — the real
control is the password hash behind it). Both pre-existing, both already
understood trade-offs in the code's own comments, not new findings.

`tsc`/`eslint`/`next build` all clean after every fix.

### 5. Phase 15 — SEO audit — DONE (2026-08-16)
Full audit of metadata coverage, canonicals, JSON-LD, sitemap/robots
consistency, Open Graph, heading hierarchy, and URL structure. Checked
clean, no action needed: every route has real per-page metadata (no generic
fallback), all noindex coverage (cart/checkout/account/search/wishlist,
admin) correct, page-2+ self-canonicalization handled on all five paginated
listings, zero fabricated ratings/reviews, real `availability`, honest OG
image degradation (never a broken/placeholder URL), Latin-transliterated
slugs throughout, exactly one `<h1>` per page at runtime in the current
data.

**Verified no broken URLs from the migration**: diffed every product and
category slug in the Phase 13 backup (Medusa's original data) against the
current `shop` schema — byte-for-byte identical, 16/16 products and 28/28
categories. No slug changed, so no redirect rules are needed.

**Fixed:**
- **PDP hardcoded the placeholder instead of the real-image-aware
  component** — `proionta/[handle]/page.tsx` called `PlaceholderTile`
  directly while `ProductCard`/`SearchResultRow` both use `ProductImage`
  (which renders the real photo via `next/image` the moment one exists).
  The single most important page for image SEO was the one place that
  would have silently stayed placeholder-only forever. Swapped in
  `ProductImage`; also added `image` to the Product JSON-LD, conditional on
  a real photo existing (same "only what's populated" rule as
  material/weight).
- **Homepage could render zero or multiple `<h1>`s** — `HeroSlide`'s
  heading was conditional on admin content (`{heading && <h1>}`), and
  `HeroCarousel` mounts every slide simultaneously (CSS scroll-snap, not a
  single-active-slide carousel) — so 2+ published hero slides would put 2+
  real `<h1>`s on the page at once (not caught by the audit's own
  single-slide sample, since 0 slides are published in production today).
  Fixed: only the first/active slide renders `asH1`, later slides render
  the same heading as a `<p>`; a blank heading on the first slide now falls
  back to an `sr-only` `<h1>STIA</h1>` instead of omitting the tag
  entirely.
- **11 content pages shared one meta description** — `sxetika`,
  `apostoles`, `epistrofes`, `aporrito`, `oroi-xrisis`, `faq`,
  `paraggelia`, `epikoinonia`, `odigoi-agoron`, `karieres`, `cookies` all
  inherited the root layout's generic storefront description verbatim,
  since none set their own. Fixed with a real fix, not a fabricated one:
  `lib/seo-text.ts`'s `deriveMetaDescription` derives a real description
  from the page's own `body` text (truncated to ~160 chars at a word
  boundary) — genuinely that page's own content, never invented copy. Also
  wired `getSeoOverride("page", page.id)` into all 11 (the `"page"`
  `SeoResourceType` already existed in the schema but was never read
  anywhere) so a hand-written override takes priority the moment one is
  set — no admin UI exists yet to set one, deliberately not built in this
  pass (see below).
- **No `WebSite`/`SearchAction` JSON-LD** — `/anazitisi` is a real
  server-side search with its own `q` param, so it genuinely qualifies.
  Added (Google retired the sitelinks-search-box UI in 2024, so the
  practical payoff is now small — added anyway since the markup itself is
  still valid/harmless and cheap).

**Live-verified**: `WebSite`/`SearchAction` JSON-LD present and correctly
shaped on the homepage; homepage still renders exactly one real `<h1>`; a
product page's `ProductImage` swap renders identically (still the
placeholder tile, since no product has a real photo yet) with no visual
regression; Product JSON-LD correctly omits `image` until one exists.
**Not live-verified** (honestly, not just assumed): the content-page
description fix — every one of the 11 pages is unpublished with no real
body text in this database (confirmed via the admin: "0 από 11 σελίδες
είναι δημοσιευμένες"), so `generateMetadata`'s new code path has never
actually executed against real content. `deriveMetaDescription` itself was
verified directly against representative Greek text (short/long/multiline/
empty), not fabricated into the live database — this project's standing
rule against writing placeholder content into real tables. Whoever
publishes the first real page should spot-check its rendered `<meta
name="description">`.

**Deliberately deferred, not built in this pass:**
- A full admin SEO-override UI for content pages (title/description/OG/
  robots/keywords per page, mirroring `CategorySeoEditor`) — the read side
  (`getSeoOverride("page", …)`) is wired and ready, but nothing can write
  to it yet. A real feature addition, not an audit-scope fix.
- `/syllogi/*` collections are in the sitemap with zero internal links —
  discussed with the owner; 0 real collections exist in production yet, so
  there's nothing to link to today. Revisit once the first real collection
  is published.
- No default OG image — blocked on real photography/brand assets, same
  category as every other image-dependent gap in this project.
- No www/protocol canonicalization in code — likely a Vercel
  domain-config-layer decision once a real domain is attached, not a code
  gap; needs an explicit decision at that point, not a guess now.

`tsc`/`eslint`/`next build` all clean after every fix.

### 6. Phase 16 — performance audit — DONE (2026-08-16)
Full audit of database connection handling, caching, query efficiency,
bundle size, images, fonts, streaming, and middleware overhead. Checked
clean, no action needed: query shapes (no N+1 anywhere — one aggregated
query per listing, recursive CTEs for category subtrees, `COUNT(*) OVER()`
for pagination), index coverage (every `WHERE`/`JOIN`/`ORDER BY` column in
the hot paths is indexed), bundle composition (zero heavy third-party
libraries, `zod` never reaches the browser, admin/storefront properly
route-split), font loading (`next/font/google`, self-hosted, no external
request), and `proxy.ts` (cheap cookie/header work only, correct matcher).

**The real find — root-caused the EMAXCONNSESSION warning every build
printed all session:** `DATABASE_URL` is on Supabase's **session-mode**
pooler (port 5432, hard 15-connection cap, no multiplexing). `next build`
spawns 11 worker processes, each importing `lib/db/client.ts` fresh (its
own pool, `max: 5` in production), so up to 55 simultaneous connections hit
a 15-connection cap — arithmetic, not a fluke. The same session-mode
configuration is also a **real production connection-exhaustion risk**
once real concurrent Vercel traffic exists (`~3` warm lambda instances at
`max: 5` would saturate the cap), not just a build-time annoyance.

**A real attempt was made to switch to transaction-mode pooling (port
6543, normally the correct choice for many short-lived serverless
connections) and was reverted** — it broke every single query with
Postgres error 57014 "canceling statement due to statement timeout," for a
reason not diagnosable from code alone (needs Supabase dashboard access:
checking Supavisor's actual pool assignment/statement_timeout for this
project). `DATABASE_URL` is back on session mode (port 5432), confirmed
working. **`prepare: false` was kept in `client.ts`** — harmless on session
mode, required if transaction mode is ever retried, so left on
unconditionally rather than re-discovering the requirement blind next
time.

**Fixed instead — a safe, achievable mitigation for the actual observed
problem, not a guess at the unresolved one:** `lib/db/client.ts` now
detects `next build`'s phase (`NEXT_PHASE === "phase-production-build"`)
and caps the pool at `max: 1` during it — 11 workers × 1 = 11, under the
15-connection cap. **Live-verified: two consecutive full builds, zero
EMAXCONNSESSION warnings, zero "sitemap: database unreachable" fallback
messages** (previously present in every build this session). Does not
touch the separate production-runtime risk above, which still needs the
pooler-mode question resolved with real dashboard access before this goes
live with real traffic — flagged here so it isn't lost.

**Also fixed (all live-verified, not just read):**
- `getSearchCatalog` (`db/catalog.ts`) ran the full active-catalog query —
  every product, `json_agg`'d variants and all — **uncached, on every
  debounced keystroke** in the header search box. Now `unstable_cache`'d
  (60s, tagged), invalidated precisely by product/variant saves and bulk
  actions. (`unstable_cache` requires a JSON-serializable return; the
  function's `Map`/`Set` result is now built from a cached plain-array
  payload rather than cached directly, since a `Map`/`Set` would silently
  come back empty through JSON serialization otherwise.) Verified live:
  searching "τηγανι" still correctly returns both Greek-accent-insensitive
  matches.
- `getNavCategories` — uncached, runs on every single page (root layout's
  header/mega-menu) and was fetched **twice per homepage request**
  (layout.tsx and page.tsx both called it independently; no `React.cache()`
  existed anywhere in the codebase). Now `React.cache()`-deduped per
  request and `unstable_cache`'d (60s, tagged) cross-request, invalidated
  by category/collection admin saves. Verified live end-to-end: renamed
  "Κουζίνα" → "Κουζίνα QA" via the admin, confirmed the new name appeared
  on the homepage immediately (not after a 60s wait), reverted.
- PDP called `getProductByHandle` twice per request (`generateMetadata`
  and the page body, same handle) — wrapped in `React.cache()`.
- PDP's `parentCategory` was a genuine sequential waterfall (product →
  category → parent category, not just a reorderable one) —
  `getCategoryWithParentByHandle` now gets both in one query via a second
  join, eliminating the round trip entirely rather than just reordering
  it. Verified live: breadcrumbs still resolve correctly
  ("Αρχική / Κουζίνα / Μαχαίρια & Κοπή / …").
- No `<Suspense>` boundary existed anywhere in the codebase (grep: zero
  hits), so every page blocked on its slowest query before returning
  anything. Added boundaries around the below-the-fold, independent
  sections that don't need to gate the rest of the page: homepage's two
  `ProductRail`s and promo banner, PDP's related-products rail (PDP's
  `RecentlyViewed` is already a Client Component fetching client-side
  after hydration — never blocked SSR, needed no change). Added a
  `loading.tsx` for the `(storefront)` route group for instant feedback on
  client-side navigations (the shared layout doesn't re-fetch on
  navigation within itself, so this specifically helps page-content
  transitions). Verified live: homepage and PDP both render full real data
  correctly with the boundaries in place, zero console errors.

**Deliberately deferred, not built in this pass:**
- The session-vs-transaction pooler mode question itself — needs Supabase
  dashboard access to diagnose the transaction-mode failure properly, not
  a blind second attempt.
- `EditorialBanner.tsx`'s raw `<img>` (bypasses `next/image`) — dormant
  until real banner images exist, same category as every other
  image-dependent gap in this project.
- Un-indexable `title`/`min_price` in-memory sorts — irrelevant below a
  few thousand SKUs.
- `admin/products.ts`'s two small multi-query loops (`bulkSetStock`, the
  collection-assignment loop) — admin-only, small N, real but low
  priority.
- Enabling Next 16's `cacheComponents`/`use cache` directive — an
  app-wide toggle that changes the caching model for every route at
  once; `db/content.ts`'s own comment already flagged this as "a
  decision for the performance phase, made on its own merits and
  verified" — correctly not something to fold into an audit-fix pass
  alongside everything else here.

`tsc`/`eslint`/`next build` all clean throughout.

### 7. Phase 17 — final cleanup & docs — DONE (2026-08-17)
The whole 17-phase migration is now complete. Scoped down from a full
rewrite of every project doc (unrealistic in one pass — `PROJECT_MEMORY.md`
alone is 182KB) to what actually matters for a fresh session: added a short
"⚠ Superseded" banner to the top of `PROJECT_MEMORY.md`, `CURRENT_STATE.md`,
`TASKS.md`, `NEXT_STEPS.md`, and `ADMIN_GUIDE.md` (all still describe the
Medusa v2 architecture as current, dated 2026-08-11/12, before this branch
existed), each pointing at this file as the actively-maintained source of
truth instead. `ADMIN_GUIDE.md` in particular was genuinely misleading for
the store owner, not just an AI session — it documents the old Medusa
Admin at `localhost:9000/app`, which no longer exists; a real rewrite for
the new `/admin` dashboard is a known, flagged gap, not attempted here.
Appended one `CHANGELOG.md` entry summarizing the whole migration plus the
Phase 14–16 audits' real findings, matching that file's own "newest
first, focus on why" convention rather than duplicating this file's detail.
The historical body content of all five files is untouched — real
product/UX decisions worth mining, just not current architecture.

---

## Things a new session must not get wrong

- **This is not the Next.js in your training data.** `middleware.ts` is
  `proxy.ts`. `revalidateTag(tag, profile)` takes two arguments and expires
  lazily; **`updateTag(tag)`** is the one with read-your-own-writes semantics
  inside a Server Action — the CMS depends on it. Read
  `apps/storefront/node_modules/next/dist/docs/` before assuming an API.
- **Empty string is this data's "unset".** Rows imported from Medusa hold `''`
  rather than `NULL` for every unfilled field. `??` accepts `''` and produces
  blank titles and raw slugs in the UI. Use `||`. This has bitten three times
  (site settings, homepage SEO, content page titles).
- **`server-only` is load-bearing.** It already caught a Client Component
  pulling the Postgres driver into the browser bundle. Types and pure helpers
  live in `lib/content-types.ts`, which never imports the DB.
- **Every admin Server Action authenticates itself** with `requireAdmin()` /
  `requireOwner()` before reading its arguments. `proxy.ts` only checks that a
  cookie exists — it is a redirect convenience, never the access control.
- **Order completion is the one place "roughly right" is not good enough.**
  The stock decrement's WHERE clause is the concurrency control. Do not
  refactor it into a read-then-write. `pnpm db:test-concurrency` proves it.
- **Do not push.** Commit per phase; pushing needs explicit instruction.

---

## Verification standard used so far

Every phase ends with `tsc` + `eslint` + `next build` clean **and** live
browser verification of the real flow — not just code inspection. Test data
created for verification is always reverted, and the revert is checked.
