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
| **12 — Data migration & verification** | ⬜ partially done early | — |
| **13 — Remove Medusa** | ⬜ NOT STARTED | — |
| 14 — Security audit | ⬜ | — |
| 15 — SEO audit | ⬜ | — |
| 16 — Performance audit | ⬜ | — |
| 17 — Final cleanup & docs | ⬜ | — |

**The storefront and the admin are both fully functional on Postgres.**
Medusa is no longer used by any running code — but it has not been deleted yet.

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

node db/import-from-medusa.mjs      # re-sync catalog from Medusa (read-only on public)
node db/create-admin.mjs <email> <password> "<name>" owner
node db/seed-test-order.mjs create|remove
node ../../scripts/db/export-backup.mjs   # full JSON backup → gitignored backups/
```

Admin: `http://localhost:3000/admin/login` — owner account is
`th.mavrakis@gmail.com`. **The password is still the temporary one generated
during Phase 7; the owner intends to change it via
`/admin/settings`.**

---

## Live data (verified, all test data removed)

16 products · 28 categories · 0 collections · 16 variants (every real product
has exactly one — the earlier "36 variants" figure in this file was stale/
wrong, confirmed 2026-08-16 by querying both `shop.product_variant` and
Medusa's original `public.product_variant`: neither ever had a real
multi-variant product) · 7 customers · 0 orders · 0 discounts · 1 admin ·
3 shipping methods · stock all 100.

**Medusa's 152 `public` tables are untouched and still hold the original data.**

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

### 3. Phase 13 — remove Medusa
Not started. `apps/backend/` (4,682 LOC + ~500 `.medusa` build artifacts) is
still on disk and still in git. Also to remove: `NEXT_PUBLIC_MEDUSA_*` env
vars, `railway.json`, `render.yaml`, the nested workspace/turbo config, and
finally the Medusa tables in `public` — **only after** a fresh backup and a
final field-level verification against `shop`.

### 4. Phases 14–17
Security, SEO, performance audits and final doc consolidation.

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
