# Deployment Runbook

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
| `NEXT_PUBLIC_SITE_URL` | leave unset until a real domain exists | Vercel auto-provides `VERCEL_URL` for every deployment, so canonical/sitemap/OG URLs are already correct with zero config (see `lib/site-config.ts`) — set this only once `stia.gr` (or whatever the real domain ends up being) is actually registered and attached |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | optional, together | required for image upload — see `MIGRATION_PLAN.md`'s "Image upload (blocked on credentials)" section |
| `GOOGLE_PLACES_API_KEY` | optional | address autocomplete degrades to manual entry if unset |
| `GEMI_API_KEY` | optional | ΓΕΜΗ company lookup degrades to manual entry if unset |

**Pooler mode is an open question — read this before deploying with real
traffic.** Vercel runs every read and write directly against Postgres
(instead of a persistent Node server holding its own connections), so a
raw direct connection is wrong here regardless — some Supabase pooler is
required. Local dev currently runs on the **session-mode** pooler (port
5432), which is proven working but has a hard 15-connection cap and
doesn't multiplex: a Phase 16 performance audit (2026-08-16) found this is
exactly what caused every local build's `EMAXCONNSESSION` warning (11
build workers × `max: 5` each), and the same cap is a real
connection-exhaustion risk once concurrent production traffic exists.
**Transaction mode (port 6543)** is the normal answer for many short-lived
serverless connections — but a real attempt to switch to it that session
broke every single query with Postgres error 57014 ("canceling statement
due to statement timeout") for a reason not diagnosable without Supabase
dashboard access, and was reverted back to session mode. `lib/db/client.ts`
already has `prepare: false` set (required for transaction mode, harmless
on session mode) so the code side is ready — but do not flip
`DATABASE_URL` to port 6543 for production without first reproducing and
resolving that error with real dashboard access to this project's Supavisor
configuration. See `MIGRATION_PLAN.md`'s Phase 16 section for the full
investigation.

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

## Manual steps that can't be automated from here

1. Create the Vercel project (if not already done), connect this GitHub
   repo, set Root Directory to `apps/storefront`, paste the environment
   variables above.
2. (Optional, later) Register a real domain, attach it in Vercel, set
   `NEXT_PUBLIC_SITE_URL`.
3. (Optional, once ready) Set up Supabase Storage + `NEXT_PUBLIC_SUPABASE_URL`/
   `SUPABASE_SERVICE_ROLE_KEY` for image upload.
