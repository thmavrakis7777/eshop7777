# Deployment Runbook

**Status: LIVE in production**, corrected 2026-08-24 — this file used to
read like deployment was still a future step ("create the Vercel project if
not already done"). It isn't a future step: the Vercel project (`eshop7777`,
under the `harris-7777` team) is live today, auto-deploying from `main` on
every push, serving `mavrakishome.gr`, `www.mavrakishome.gr`,
`mavrakishome.com`, and `www.mavrakishome.com` — all aliased to the same
production deployment. `origin/main` and `origin/custom-dashboard-migration`
currently point at the identical commit, so everything described in
`MIGRATION_PLAN.md` is what's actually running. The rest of this file is
still accurate as a *runbook* (how the pieces are configured, why session-
mode pooling was chosen) — read it as "how the live setup works," not "what
still needs to happen."

Target architecture (rewritten 2026-08-16, Phase 13 of `MIGRATION_PLAN.md` —
Medusa is gone, there is no longer a separate backend to deploy):

```
Vercel (Free)  →  Supabase Postgres
 storefront +       (already in use, RLS-locked)
 admin dashboard
```

One app, one deploy target. The storefront and the admin dashboard are both
routes inside `apps/storefront` — direct SQL server-side (`postgres`, see
`apps/storefront/src/lib/db/`), no separate API service to stand up, no CORS
dance between two hosts, no second platform to pay for or monitor.

This file is the checked-in half of the setup: config-as-code, exact
variable *names*, and non-secret values. **Actual secret values are never
written here** — see each section for where to get them.

**A real CSP is active** (`apps/storefront/src/proxy.ts`) — `script-src`/
`connect-src`/`img-src` only allow the domains this app actually uses today
(self, plus GA4/GTM/Meta Pixel/Clarity's real domains). If a new third-party
script/embed gets added later, it will be silently blocked by the browser
until its domain is added to `proxy.ts`'s CSP header — check the browser
console for a CSP violation error first if something added later "doesn't
load" in production.

## 1. Vercel (storefront + admin)

**Root Directory**: `apps/storefront`. Framework preset: Next.js
(auto-detected). Build/start commands: Vercel's Next.js defaults, no
override needed.

**Environment variables to set in Vercel's dashboard** (Project → Settings →
Environment Variables, Production) — see `apps/storefront/.env.example` for
the full list with explanations:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | the Supabase connection string already in use locally | copy exactly from `apps/storefront/.env.local` — **do not retype**, do not paste it anywhere else (not in this file, not in chat/logs) |
| `NEXT_PUBLIC_SITE_URL` | `https://www.mavrakishome.gr` | The real domain is registered and attached (this was written when it wasn't). `lib/site-config.ts`'s resolution order is `NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → a hardcoded `https://www.mavrakishome.gr` fallback, and the SEO audit (Phase 15) confirmed canonical/sitemap/OG URLs are correct in production either way — but whether this var is explicitly set in Vercel or the fallback happens to match wasn't checked here; set it explicitly rather than relying on the fallback. |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | optional, together | required for image upload — see `MIGRATION_PLAN.md`'s "Image upload (blocked on credentials)" section |
| `GOOGLE_PLACES_API_KEY` | optional | address autocomplete degrades to manual entry if unset |
| `GEMI_API_KEY` | optional | ΓΕΜΗ company lookup degrades to manual entry if unset |

**Use the session-mode pooler (port 5432). This is a measured decision.**

Vercel runs every read and write directly against Postgres rather than
from a persistent Node server, so a raw direct connection is wrong here
regardless — some Supabase pooler is required. Conventional advice is that
**transaction mode (6543)** suits many short-lived serverless connections
better than session mode's hard 15-connection cap. That advice does not
survive contact with this project.

A controlled benchmark (2026-08-17) ran the same six real query shapes —
scalar, array, transaction, 6-way concurrency, numeric parse, post-idle
reuse — against both ports, three times each, at the same pool size:

| Pooler | Clean runs | Behaviour |
|---|---|---|
| Session (5432) | **3/3** | consistently ~1.87s |
| Transaction (6543) | 1/3 | two runs deadlocked 20s on the concurrency step |

Transaction mode is **intermittently** unreliable here — a concurrent
burst can wedge until `statement_timeout` (120s, confirmed in the
dashboard). Both earlier failed attempts were this same deadlock wearing
different clothes: once as "57014 statement timeout", once as "15-20s page
loads". A serverless deployment is exactly the concurrent-burst workload
that triggers it, so this is a reason not to switch, not a reason to
switch.

**If you ever revisit it**, reproduce 3/3 clean benchmark runs first, and
note that `fetch_types: false` is not an acceptable workaround: without
pg_catalog introspection postgres.js serialises array parameters as
comma-joined strings and Postgres rejects them with 22P02, silently
breaking every `= ANY(${array})` query while scalar queries keep working.

The session-mode connection cap that motivated all this is separately
handled: `lib/db/client.ts` caps the pool at 1 during `next build` (which
is what produced the old `EMAXCONNSESSION` warnings), and at 5 per
instance at runtime.

## 2. Supabase (database)

Already in production use, already verified live:
- **RLS**: every table in `shop` has RLS enabled with zero policies (full
  lockdown) — correct, since nothing in this codebase uses `supabase-js`/
  PostgREST; all access is server-side `postgres.js` with the connection
  string, which bypasses RLS the same way a superuser role does.
- **Migrations**: run manually, not on every deploy — `pnpm db:migrate` from
  `apps/storefront` (see `MIGRATION_PLAN.md`'s "Operational commands"). Run
  this once after pushing a migration-adding commit, before or right after
  the Vercel deploy that depends on it.
- **Connection type**: see the Session pooler note above — this changed from
  the Medusa-era setup, which ran as a persistent process and used a direct
  connection.

## Current state (done, kept here for reference / redeploying elsewhere)

1. **Vercel project**: `eshop7777`, team `harris-7777`, connected to GitHub
   (`thmavrakis7777/eshop7777`), Root Directory `apps/storefront`, auto-deploys
   on every push to `main`. Environment variables above are set in production.
2. **Domain**: `mavrakishome.gr` / `mavrakishome.com` (both with and without
   `www.`) are registered and attached, all aliased to the production
   deployment. `NEXT_PUBLIC_SITE_URL` should be set to
   `https://www.mavrakishome.gr` per the table above.
3. **Supabase Storage**: `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
   are configured; image upload works in production (`MIGRATION_PLAN.md` §2).

None of the above is a remaining setup step — it's the record of what's
already configured, kept here so redeploying to a new Vercel project (a
disaster-recovery scenario, not the normal path) has a real checklist to
follow instead of guessing.
