# Project Memory — STIA Houseware Store

Living reference for anyone (human or agent) picking this project up cold. Keep this
updated as architecture decisions are made — don't let it drift from reality.

Read this alongside `CURRENT_STATE.md` (what exists right now) and `NEXT_STEPS.md`
(exactly where to resume).

## Project purpose / business goal

A premium Greek home & houseware ecommerce store — kitchen, bathroom, storage,
cleaning, garden, home accessories. Target market is Greece specifically (Greek
language, Greek payment methods, Greek address/tax format). The design goal stated
at project start: feel like a premium European retail chain (IKEA / Zara Home / Muji
/ Joseph Joseph / OXO / Made.com), not "another Shopify store" — minimal, elegant,
fast, product-photography-led, zero clutter. Full original IA/wireframe/design-system
rationale lives in the plan history from the first session; this file tracks the
**as-built** state, not the original brief verbatim.

## Technology stack

**Monorepo** (pnpm workspaces), two independent apps that do **not** share a pnpm
workspace with each other (see root `pnpm-workspace.yaml` — `apps/backend` is
explicitly excluded via `!apps/backend` / `!apps/backend/**`, because it's its own
nested Turborepo/pnpm workspace):

- `apps/storefront` — the customer-facing site.
- `apps/backend` — the commerce engine + admin, itself a Turborepo workspace
  containing the real Medusa app at `apps/backend/apps/backend`.

### Frameworks / frontend architecture

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript** (strict mode).
- **Tailwind CSS v4** — theme tokens defined via `@theme inline` in
  `src/app/globals.css` (not a `tailwind.config.js` — v4 convention). Custom
  properties like `--color-accent`, `--radius-md` auto-generate matching Tailwind
  utility classes (`bg-accent`, `rounded-md`, etc.).
- **Server Components by default.** Data fetching happens in `async` Server
  Component pages/layouts; interactivity (menus, forms, sort controls) is isolated
  into small `"use client"` components. `RootLayout` fetches nav categories once and
  passes them down as props — `Header`/`Footer`/`MobileMenu`/`CategoryGrid` take
  `categories`/`NavCategory[]` as props, they don't fetch their own data.
  See `apps/storefront/src/app/layout.tsx`.
- No global state library, no cart state yet (there is no cart — see Phase 5 in
  `TASKS.md`). No CSS-in-JS. No component library dependency (all UI is
  hand-built in `src/components`).

### Backend architecture

- **Medusa v2** (`@medusajs/medusa` 2.18.0), self-hosted, Node/TypeScript. Chosen
  over Shopify specifically because Shopify's hosted checkout can't be fully
  customized — Medusa gives a real self-hosted checkout + admin + Postgres-backed
  catalog, at the cost of owning hosting/ops ourselves (that hosting decision is
  still open — see `TASKS.md`).
- File-based API routes (`src/api/store/*`, `src/api/admin/*`) — none currently
  custom; only Medusa's built-in Store/Admin REST APIs are in use.
- Business logic belongs in Medusa workflows, not route handlers, per Medusa
  convention (not yet exercised — no custom workflows written yet, only the
  built-in ones used via Admin API calls during catalog seeding).

### Database

- **PostgreSQL**, hosted on **Supabase** (not local, not Docker) — project ref
  `tuvbesrqizixqrunvlnt`. Connection string lives in
  `apps/backend/apps/backend/.env` (gitignored, never committed).
  See "External services" below for connection details and fallback.
- No ORM code written directly — Medusa's own MikroORM-based data layer owns the
  schema; migrations are Medusa's built-in ones (`medusa db:migrate`), no custom
  migrations written yet.
- **Redis is deliberately not used.** `REDIS_URL` was removed from `.env` — Medusa
  falls back to in-memory event bus/workflow engine for local dev. Fine for one
  dev instance; would need real Redis before running multiple backend instances.

### Important libraries

- `next/font/google` for Inter + Literata (self-hosted, not runtime-loaded).
- No `@medusajs/js-sdk` in the storefront — deliberately a hand-rolled thin `fetch`
  wrapper instead (`src/lib/medusa.ts`), to keep the storefront's only server
  dependency being "an HTTP API" rather than an SDK version lockstep with the
  backend. If this ever becomes painful, swapping in the official SDK is a
  contained change inside `lib/medusa.ts` + `lib/data/*.ts` only.
- `react-dom`'s `createPortal` for the mobile menu drawer (rendered into
  `document.body`, not inline — required because the header's `backdrop-filter`
  creates a CSS containing block that traps `position: fixed` descendants; see
  "Important technical decisions").

## Design system

- **Color**: white background, warm light-gray surface, warm charcoal ink (not
  pure black), one accent — muted terracotta (`--color-accent: #b5502e`). No
  gradients, no rainbow palette. Tokens in `globals.css` under `:root` and mapped
  into Tailwind's theme under `@theme inline`.
- **Typography**: **Inter** for UI/body, **Literata** for display/headlines
  (serif, used sparingly on h1/h2/h3/h4). Both were explicitly verified via
  Google Fonts' metadata API to have real Greek-glyph coverage before being
  chosen — the original pick for display type, **Newsreader**, was rejected after
  verification showed it has **zero** Greek support. Don't pick a font for this
  project without checking `https://fonts.google.com/metadata/fonts/<Name>`
  first; Latin-looking font names are not a reliable signal for Greek support.
- **Grid/spacing**: Tailwind's default spacing scale (a dead custom `--space-*`
  token set was found unused and removed during the audit — don't reintroduce
  parallel spacing tokens).
- **No real product photography yet.** `PlaceholderTile`
  (`src/components/ui/PlaceholderTile.tsx`) renders a deterministic
  color-block + initials standing in for every product/category image. Swapping
  in real photos is a contained change to that one component plus adding
  `next/image` usage — not yet started.
- **Motion**: subtle only (150–200ms ease-out on hover/state changes). No
  scroll-jacking, no entrance animations.

## Coding conventions

- Storefront: 2-space indent, double quotes (Next.js/ESLint defaults), no
  semicolons are *not* enforced (semicolons used) — follow existing file style,
  don't reformat wholesale.
- Backend: **no semicolons, double quotes, 2-space indent** (enforced by
  `@medusajs/eslint-plugin`'s recommended config — see
  `apps/backend/eslint.config.ts`). Files kebab-case, types/classes PascalCase,
  functions/variables camelCase, DB columns snake_case. Never disable a
  `@medusajs/*` lint rule to make lint pass — it usually means the code is
  actually structurally wrong (route/workflow/module shape), not just a style
  nit. See `apps/backend/AGENTS.md` for the full backend-specific convention
  list (also covers package-manager detection, common mistakes, off-limits
  paths — read it before backend work).
- Domain types (`apps/storefront/src/lib/types.ts` — `Product`, `Category`,
  `NavCategory`, `Money`) are the storefront's **own** shapes, deliberately
  decoupled from Medusa's raw API response shapes. `lib/medusa.ts` types
  (`MedusaProduct`, `MedusaCategory`, etc.) are the raw wire types; `lib/data/*.ts`
  is the only place that converts between them. UI components must never import
  from `lib/medusa.ts` directly — only from `lib/types.ts` and `lib/data/*.ts`.
- Never fabricate data to make the UI look more complete than it is (see "UX
  decisions" below) — this bit the project once already (hardcoded 4.6-star
  ratings on every mock product) and was treated as a real bug, not a style nit.

## SEO strategy

- `generateMetadata` per dynamic route (category, subcategory, product) — title
  via the root layout's template (`%s | STIA`), description, canonical URL,
  Open Graph.
- JSON-LD: sitewide `Organization` (root layout), `BreadcrumbList` on every
  category/subcategory/product page (`components/category/Breadcrumbs.tsx`
  generates both the visible breadcrumb and its schema from the same data — no
  hand-duplicated schema), `Product` schema on PDPs. **No `AggregateRating`
  schema** — would require real reviews, which don't exist; don't add rating
  schema until real review data exists.
- `robots.ts` and `sitemap.ts` are dynamic (`MetadataRoute` API), not static
  files — `sitemap.ts` enumerates the real catalog from Medusa at request time
  (paginated fetches would be needed past ~a few thousand SKUs; fine at today's
  scale — see the comment in that file).
- Category/subcategory pages are real server-rendered routes with their own
  H1/intro copy — not thin filter-only pages, so they're legitimately indexable.
- `siteUrl`/`siteName` live in one place (`lib/site-config.ts`) — every
  consumer (metadata, JSON-LD, robots, sitemap) imports from there. Don't
  reintroduce a hardcoded `"https://www.stia.gr"` string anywhere else.

## UX decisions

- **Never fabricate trust signals.** No star ratings/review counts render unless
  real (`Product.rating`/`reviewCount` are optional, checked before rendering).
  The homepage's featured-products rail is labeled "Προτεινόμενα" (curated/
  featured), not "Τα πιο δημοφιλή" (best sellers) — there is no order history to
  back a real popularity claim yet. Revisit both labels once real
  review/order data exists.
- Max 3 clicks from homepage to any product (Home → Category → Subcategory →
  Product), enforced by the IA, not just a design aspiration.
- Mega menu (desktop) and a separate accessible drawer (mobile) rather than one
  responsive component doing both — the interaction models are different enough
  (hover-driven vs. tap-driven with focus trapping) that sharing one component
  was making both worse.
- Sticky/accessible patterns: skip-to-content link, focus-visible outlines,
  mobile drawer has real focus management (initial focus, Tab trap, Escape to
  close, focus returns to the trigger button on close) — this was originally
  missing and was added as a real accessibility bug fix, not a nice-to-have.
- "Add to cart" buttons exist in the UI (`ProductCard` quick-add,
  `AddToCartButton` on the PDP) but are **intentionally inert**
  (`preventDefault()`, no-op) — there is no cart system yet. This is consistent
  across the site on purpose, not a bug; don't "fix" one without building the
  other, and don't ship a cart button that pretends to work when clicked.

## Important technical decisions (things that would be expensive to re-derive)

- **Medusa's Store API has no `currency_code` query param** on `/store/products`
  — pricing requires `region_id` (or an explicit country). `getDefaultRegionId()`
  in `lib/medusa.ts` resolves the one region that exists today ("Europe", EUR).
  This will need real per-country resolution if a second region/currency is ever
  added — right now it just takes the first region unconditionally.
- **Category filtering does not include descendants.** Medusa's
  `/store/products?category_id[]=` does an exact-match/OR filter on the IDs you
  give it — it does **not** automatically include a category's subcategories.
  Products are tagged with one specific (usually leaf) category. Browsing a
  top-level category page therefore requires resolving the category's own ID
  *plus* its direct children's IDs before querying — see
  `getCategoryIdsForHandle()` in `lib/data/categories.ts`. This was a real bug
  (top-level category pages showed "0 products") caught during Phase 3
  verification, not a theoretical concern.
- **The store's region must include Greece.** Medusa's own default demo seed
  (which ran automatically once, via `db:migrate`, before the real catalog was
  seeded) created a region covering Germany/Denmark/Spain/France/UK/Italy/Sweden
  — **not Greece**. This was fixed via the Admin API (added `"gr"` to the
  region's countries, created a matching Greek tax region) but is exactly the
  kind of default that silently breaks checkout/tax for real customers if it's
  ever reset. If the database is ever rebuilt from scratch, re-check
  `GET /admin/regions` includes Greece before assuming checkout will work.
- **`apps/backend` is excluded from the root pnpm workspace on purpose.** It's
  its own nested Turborepo/pnpm project (complete with its own
  `pnpm-workspace.yaml`, lockfile, `turbo.json`). Don't try to "fix" this by
  merging it into the root workspace — that was evaluated and rejected because
  Medusa's own tooling expects to own its workspace root.
- The mobile menu is rendered via `createPortal` into `document.body`, not
  inline in the component tree — the header's `backdrop-blur` (`backdrop-filter`)
  creates a CSS containing block that traps `position: fixed` descendants inside
  the header's bounding box instead of the viewport. This is a real, easy-to-
  reintroduce CSS gotcha — if a future change needs another `fixed`-positioned
  overlay near the header, check for this before assuming a portal is
  unnecessary.

## Environment setup

This machine has **no admin rights available to Claude Code sessions** (UAC
prompts can't be approved non-interactively). Tooling was installed as portable,
no-admin extracts:

- **Node.js 24 LTS**: `%LOCALAPPDATA%\NodeJS\node-v24.19.0-win-x64\` — added to
  the persistent user `PATH`, but if a fresh shell doesn't have it on `PATH`,
  prepend it manually:
  `export PATH="/c/Users/t.mavrakis/AppData/Local/NodeJS/node-v24.19.0-win-x64:$PATH"`
- **pnpm**: via corepack (`corepack enable && corepack prepare pnpm@latest --activate`).
- **GitHub CLI**: `%LOCALAPPDATA%\GhCli\bin\gh.exe` — also portable, also on `PATH`.
  Already authenticated (`gh auth login` device flow, `gh auth setup-git` wired
  the git credential helper) as `thmavrakis7777`.
- **Storefront**: `apps/storefront/.env.local` (gitignored) needs
  `NEXT_PUBLIC_MEDUSA_BACKEND_URL` and `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` — see
  `apps/storefront/.env.example` for the shape. The publishable key is meant to
  be client-exposed (like a Stripe publishable key) — not a secret the way the
  DB password is.
- **Backend**: `apps/backend/apps/backend/.env` (gitignored) needs `DATABASE_URL`
  (Supabase connection string), `STORE_CORS`/`ADMIN_CORS`/`AUTH_CORS`,
  `JWT_SECRET`, `COOKIE_SECRET`. See `.env.template` in the same directory for
  the shape (kept in sync with the real required vars, no secret values).
- To run both apps locally: `pnpm run backend:dev` from `apps/backend` (admin
  at `localhost:9000/app`), `pnpm dev` from the repo root (storefront at
  `localhost:3000`). Admin login: `admin@stia.gr` — password is not written down
  anywhere in the repo (rotate it if forgotten rather than searching for it).

## Development rules

- **Verify claims against the running system, don't trust assumptions about
  Medusa's API shape** — two of the real bugs found this session (the missing
  `currency_code` param, the category-descendants filtering gap) were caught
  specifically by curling the live Store API before building more code on top
  of an assumption. Do this again for any new Medusa endpoint usage.
- **Don't fabricate placeholder data that looks real** (fake ratings, fake
  "best seller" claims, fake stock counts) — treat this as a correctness bug,
  not a style preference, per "UX decisions" above.
- **Restart the dev server with `rm -rf .next` before trusting a dev-server
  error that contradicts `pnpm build`.** Turbopack's dev HMR has gone stale
  multiple times this project (throwing `ReferenceError`s for code that's
  demonstrably correct per a clean build) — see `CURRENT_STATE.md` for the
  current troubleshooting note.
- Keep `PROJECT_MEMORY.md`, `TASKS.md`, and `CHANGELOG.md` updated as part of
  the same change, not as an afterthought — this file existing and being
  accurate is what let this handoff happen without re-deriving the whole
  project from source.

## External services

- **GitHub**: [thmavrakis7777/eshop7777](https://github.com/thmavrakis7777/eshop7777),
  `main` branch, authenticated via `gh auth login` (device flow already
  completed), git credential helper configured via `gh auth setup-git`.
- **Supabase**: project ref `tuvbesrqizixqrunvlnt`. Direct connection string (not
  the session pooler) is in `apps/backend/apps/backend/.env` and has worked fine
  on this network despite direct connections normally needing IPv6 — if it ever
  stops connecting, the session pooler string is the fallback (Supabase
  dashboard → Connect → Session pooler).
- **Vercel**: connected per the user, not yet used. Backend hosting decision is
  still open — Vercel's serverless model can't run Medusa's persistent server —
  deferred until it's actually needed (explicit prior user decision, don't
  revisit without cause).

## Placeholders that need real values before this is a real store

- Brand name "STIA" and domain `stia.gr` — never trademark-checked, purely a
  working placeholder chosen during Phase 1.
- Product photography — `PlaceholderTile` stands in everywhere a real photo
  would go.
- `JWT_SECRET`/`COOKIE_SECRET` in the backend `.env` are locally-generated
  random hex (rotated once already during the Phase 3 audit), fine for local
  dev, must be re-rotated and put in real secret management before any real
  deployment.
- Admin password (`admin@stia.gr`) — a real dev-only password, not written down
  in the repo; rotate before any real deployment regardless.
