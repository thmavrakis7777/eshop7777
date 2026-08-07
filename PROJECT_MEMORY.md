# Project Memory — STIA Houseware Store

Living reference for anyone (human or agent) picking this project up cold. Keep this
updated as architecture decisions are made — don't let it drift from reality.

## What this is

A premium Greek home & houseware ecommerce store. See the original brief's design
philosophy: minimal, elegant, fast, product-photography-led. Full IA/wireframe/design
system rationale lives in the plan history; this file tracks the **as-built** state.

## Architecture

**Monorepo** (pnpm workspaces), two independent apps that do **not** share a pnpm
workspace with each other (see `pnpm-workspace.yaml` at root — `apps/backend` is
explicitly excluded, because it's its own nested Turborepo/pnpm workspace):

- `apps/storefront` — Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4.
  Fetches all catalog data server-side from Medusa's Store API — no database
  connection of its own.
- `apps/backend` — Medusa v2 (self-hosted commerce engine), itself a Turborepo
  workspace at `apps/backend` containing the real Medusa app at
  `apps/backend/apps/backend`. Postgres is hosted on Supabase (see `.env`,
  gitignored — connection string was pasted directly, not scaffolded).

**Why this split**: decided early — Shopify was rejected because its hosted checkout
can't be fully customized; Medusa gives a real self-hosted checkout + admin +
Postgres-backed catalog, at the cost of owning hosting/ops ourselves. Supabase
solves "need Postgres" without standing up a database server locally.

## Data flow (Phase 3, current)

`apps/storefront/src/lib/medusa.ts` is a thin typed `fetch` wrapper around Medusa's
Store API (not the full `@medusajs/js-sdk` — deliberately, to keep the storefront's
only server dependency being "an HTTP API"). `apps/storefront/src/lib/data/*.ts`
adapts Medusa's response shapes into the storefront's own domain types
(`apps/storefront/src/lib/types.ts` — `Product`, `Category`, `NavCategory`), so UI
components never see a raw Medusa response. This was intentional from Phase 1: the
mock-data layer that existed before Phase 3 was shaped identically to these domain
types specifically so the real-data swap was an adapter change, not a UI rewrite.

**Pricing requires a region.** Medusa's Store API resolves `calculated_price` from
either `region_id` or an explicit country — there is **no** top-level `currency_code`
query param on `/store/products` (a real, non-obvious gotcha hit during Phase 3;
`getDefaultRegionId()` in `medusa.ts` resolves it). There is currently exactly one
region ("Europe", EUR) — `getDefaultRegionId()` just takes the first region, which is
correct today but will need real per-country resolution if a second region/currency
is ever added.

**No fabricated trust signals.** `Product.rating`/`reviewCount` are optional and only
render when present — there is no review system yet, so real products carry no
rating rather than a fake default. Similarly, the homepage's "Προτεινόμενα" (featured)
rail is explicitly *not* labeled "best sellers" — there's no order history yet to back
a real popularity claim; it shows a curated slice instead. Revisit both once real
review/order data exists.

## Known environment quirks (don't re-debug these blind)

- **Turbopack dev server HMR can go stale** after a long edit session and throw
  `ReferenceError`s for things that are clearly correct in the source (e.g. a
  duplicate-`const` error for a variable that was actually removed). If a dev-server
  error contradicts what `pnpm build` says, it's stale HMR — `rm -rf .next` and
  restart the dev server before assuming the code is wrong.
- **Separately**, the browser tool's `read_console_messages` appears to accumulate
  history across navigations within the same tab rather than reflecting only the
  current page load — it kept replaying an old error verbatim after a clean server
  restart that `preview_logs` (server-side) and direct DOM checks confirmed was no
  longer happening. When in doubt about whether a console error is *current*, check
  live DOM state (`document.querySelector(...)`) or server-side `preview_logs`
  before trusting the console buffer.
- **`computer.key` (synthetic OS-level keypresses via the browser automation tool)
  does not reliably reach the page in this environment** — confirmed by testing that
  even a plain printable-character keypress produced no effect, while
  `document.dispatchEvent(new KeyboardEvent(...))` and `computer.type` both work
  fine. When verifying keyboard-only interactions (Escape-to-close, focus traps),
  prefer `dispatchEvent` over `computer.key`.
- npm registry 429-rate-limited the `@medusajs/*` scoped packages heavily during
  install — not our config, just retry (lower `network-concurrency` helps a little).
- This machine has no admin rights available to this session (UAC prompts can't be
  approved non-interactively) — Node.js and the GitHub CLI were installed as
  **portable, no-admin extracts** into `%LOCALAPPDATA%`, not via winget/installer.
  Both were added to the persistent user `PATH`.

## External services

- **GitHub**: [thmavrakis7777/eshop7777](https://github.com/thmavrakis7777/eshop7777),
  authenticated via `gh auth login` (device flow), git credential helper configured
  via `gh auth setup-git`.
- **Supabase**: project ref `tuvbesrqizixqrunvlnt`. Direct connection string (not the
  session pooler) is in `apps/backend/apps/backend/.env` and works fine on this
  network despite direct connections normally needing IPv6 — if it ever stops
  connecting, the session pooler string is the fallback (get it from Supabase
  dashboard → Connect → Session pooler).
- **Vercel**: connected per the user, not yet used — backend hosting decision
  (Vercel can't run Medusa's persistent server) is still open, deferred until it's
  actually needed.

## Placeholders that need real values before this is a real store

- Brand name "STIA" and domain `stia.gr` — never trademark-checked, purely a working
  placeholder chosen during Phase 1.
- Product photography — `PlaceholderTile` (deterministic color-block + initials)
  stands in everywhere a real photo would go.
- `JWT_SECRET`/`COOKIE_SECRET` in the backend `.env` are locally-generated random
  hex (rotated once already during the audit — the original scaffold default
  `"supersecret"` was still in place until then), fine for local dev, must be
  re-rotated and put in real secret management before any real deployment.
