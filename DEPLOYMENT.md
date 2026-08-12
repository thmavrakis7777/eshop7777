# Deployment Runbook

Target architecture (2026-08-12, prepared this session — see `CHANGELOG.md`):

```
Vercel (Free)  →  Railway  →  Supabase Postgres
 storefront        Medusa       (already in use, RLS-locked)
```

No Medusa Cloud, no new paid add-ons (no Redis needed — see below). This file
is the checked-in half of the setup: config-as-code, exact variable *names*,
and non-secret values. **Actual secret values are never written here** — see
each section for where to get them.

**A real CSP is now active** (`apps/storefront/src/proxy.ts`, added
2026-08-12) — `script-src`/`connect-src`/`img-src` only allow the domains
this app actually uses today (self, plus GA4/GTM/Meta Pixel/Clarity's real
domains). If a new third-party script/embed gets added later, it will be
silently blocked by the browser until its domain is added to `proxy.ts`'s
CSP header — check the browser console for a CSP violation error first if
something added later "doesn't load" in production.

## Why Railway, no Dockerfile, no Redis

- **Railway over Render**: equivalent fit for a persistent Node server: both
  support Nixpacks (no Dockerfile needed), custom monorepo root directories,
  and a free/usage-based tier with no forced sleep on the plan tier Medusa
  needs. Railway's config-as-code (`railway.json`) is slightly more direct
  for this repo's turborepo layout, so it's what's prepared here. If you'd
  rather use Render, the same commands below (build/start/health check) work
  there via its dashboard equivalents — the code and env var list don't
  change either way.
- **No Dockerfile**: Nixpacks auto-detects Node + pnpm from `engines`/
  `packageManager` in `package.json` and the lockfile — a Dockerfile would
  just duplicate that.
- **No Redis add-on**: `REDIS_URL` appears in `.env.template` but is never
  referenced in `medusa-config.ts` or anywhere in `src/` (confirmed by
  search) — this app's event bus/workflow engine/cache all use Medusa's
  in-memory defaults, which is correct for a single backend instance. Adding
  Redis would be a real monthly cost for a feature this app doesn't use.

## 1. Railway (backend)

**Root Directory**: `apps/backend` (the turborepo root — *not* the nested
`apps/backend/apps/backend`; pnpm needs the workspace root to resolve
dependencies the same way local dev does). Railway auto-detects this repo
needs `apps/backend/railway.json` once Root Directory is set correctly.

`railway.json` (already committed) declares:
- **Build**: `pnpm run build` (→ `pnpm -r build` → `medusa build`, builds
  both the API and the bundled admin dashboard)
- **Start**: `pnpm exec medusa db:migrate && pnpm run start` — runs any
  pending migration before every boot, then `turbo start` → `medusa start`.
  Safe/idempotent against an already-migrated DB (this Supabase database
  already has every table Medusa needs — confirmed live this session).
- **Health check**: `GET /health` (Medusa's built-in endpoint, confirmed
  live: returns `200 OK`) — Railway uses this to know a deploy succeeded.
- Medusa reads `PORT` automatically; Railway injects it. No config needed.

**Environment variables to set in Railway's dashboard** (Project → Variables):

| Variable | Value | Where to get it |
|---|---|---|
| `DATABASE_URL` | same Supabase connection string already in use | copy exactly from `apps/backend/apps/backend/.env` — **do not retype**, do not paste it anywhere else (not in this file, not in chat/logs) |
| `JWT_SECRET` | a fresh random value | generate new for production — see below |
| `COOKIE_SECRET` | a fresh random value | generate new for production — see below |
| `AUTH_MFA_ENCRYPTION_KEY` | **the existing value, unchanged** | copy exactly from `.env` — this key encrypts MFA data already stored in this same production database; a new value would orphan it |
| `STORE_CORS` | `https://<your-vercel-domain>` | the exact Vercel production URL (get after step 2) |
| `ADMIN_CORS` | `https://<your-railway-domain>` | Railway's own assigned domain (shown after first deploy) |
| `AUTH_CORS` | `https://<your-vercel-domain>,https://<your-railway-domain>` | both of the above |
| `MEDUSA_ADMIN_ONBOARDING_TYPE` | same value already in `.env` | copy as-is |

Generate fresh values for `JWT_SECRET`/`COOKIE_SECRET` (production-only —
dev keeps its own values in the local `.env`, unaffected). Never commit
these to the repo; paste directly into Railway's dashboard only:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it twice (once per variable) — real values for this session's Railway
setup were already generated and handed to you in chat, not written here.

Optional, both degrade silently to a no-op if unset (no build/runtime
failure either way — see `PROJECT_MEMORY.md`):
`SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (order-confirmation emails).

**CORS is a two-step, do-over-once setting**: Railway's domain isn't known
until the first deploy, and Vercel's domain isn't known until *its* first
deploy. Deploy Railway first with `STORE_CORS`/`AUTH_CORS` temporarily
pointing at a placeholder, deploy Vercel, then come back and update Railway's
CORS variables with the real Vercel URL and redeploy (Railway redeploys
automatically on a variable change).

## 2. Vercel (storefront)

**Root Directory**: `apps/storefront`. Vercel auto-detects the pnpm
workspace root from the repo-root lockfile even with a subdirectory Root
Directory set, so `apps/backend` (excluded from the root workspace on
purpose — see `pnpm-workspace.yaml`) is never installed or built here,
keeping the free-tier build fast. Framework preset: Next.js (auto-detected).
Build/start commands: Vercel's Next.js defaults, no override needed —
`apps/storefront/package.json` already has the right `build`/`start`
scripts.

**Environment variables to set in Vercel's dashboard** (Project → Settings →
Environment Variables, Production):

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | the Railway backend's public URL | get this after step 1's first deploy — see "What to send back" below |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | same value already in `apps/storefront/.env.local` | copy exactly — this one is meant to be client-exposed, unlike the backend secrets above |
| `NEXT_PUBLIC_SITE_URL` | leave unset until a real domain exists | Vercel auto-provides `VERCEL_URL` for every deployment, so canonical/sitemap/OG URLs are already correct with zero config (see `lib/site-config.ts`) — set this only once `stia.gr` (or whatever the real domain ends up being) is actually registered and attached |
| `GOOGLE_PLACES_API_KEY` | optional | address autocomplete degrades to manual entry if unset |
| `GEMI_API_KEY` | optional | ΓΕΜΗ company lookup degrades to manual entry if unset |

This session already fixed the one confirmed real build failure (missing
publishable key crashing `/sitemap.xml` at build time — `sitemap.ts` now
degrades gracefully instead) and made product images work automatically
against whatever Railway domain ends up being used (`next.config.ts`'s
`remotePatterns` now derives the production image host from
`NEXT_PUBLIC_MEDUSA_BACKEND_URL` instead of being hardcoded to `localhost`).

## 3. Supabase (database)

Already in production use, already verified this session:
- **RLS**: all 152 public tables locked down (RLS enabled, zero policies —
  see `CHANGELOG.md`'s "Production security fix" entry). Confirmed Medusa's
  connection role (`postgres`) has `BYPASSRLS`, so this has no effect on the
  app. Nothing further needed here for Railway — same `DATABASE_URL`, same
  guarantees.
- **Migrations**: Railway's start command runs `medusa db:migrate` on every
  boot (see above) — no manual migration step needed on deploy.
- **Connection type**: Railway runs Medusa as a long-lived persistent
  process (not serverless), so the direct Postgres connection already in
  `DATABASE_URL` is correct as-is — no pgbouncer/connection-pooler URL
  needed (that's a serverless/Vercel concern, doesn't apply here).

## What to send back once Railway is deployed

Once you've created the Railway project, connected this GitHub repo, set
Root Directory to `apps/backend`, added the environment variables above, and
the first deploy succeeds (check `/health` returns `200`) — send the
Railway-assigned public URL (Settings → Networking → Public Domain, looks
like `https://<something>.up.railway.app`, or your own domain if you attach
one). That's the exact value for `NEXT_PUBLIC_MEDUSA_BACKEND_URL`.

## Manual steps that can't be automated from here

1. Create the Railway project, connect this GitHub repo, set Root Directory.
2. Paste the environment variables above into Railway (secrets can't be set
   by an agent without account access).
3. Create the Vercel project (if not already done), connect this GitHub
   repo, set Root Directory, paste its environment variables.
4. After both are live once, go back into Railway and update
   `STORE_CORS`/`AUTH_CORS` with the real Vercel URL.
5. (Optional, later) Register a real domain, attach it in Vercel, set
   `NEXT_PUBLIC_SITE_URL`.
