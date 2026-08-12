# Next Steps

## START HERE NEXT SESSION

Read `PROJECT_MEMORY.md`, `CURRENT_STATE.md`, `TASKS.md`, and `ADMIN_GUIDE.md`
first — this file is the pointer to exactly where to resume, those four have the
detail behind it. Do not restart the project, do not regenerate completed
features, do not re-analyze the whole codebase from zero — everything needed is
in these files. **Sections 1-7 below this point are historical/stale** (written
mid-way through an earlier session) — trust this summary and `CHANGELOG.md`
over that old detailed body if they ever disagree.

**2026-08-12 (final entry, end of session) — Pre-context-clear consolidation:
`PROJECT_MEMORY.md` got a comprehensive new "START HERE" section at the very
top — read that first from now on, before this file. A final Opus 5 audit
pass found and fixed one real production-only bug (the CSP blocked all
inline styles in production — see `CHANGELOG.md`'s newest entry) plus two
minor fixes, and flagged several real, deliberately-unfixed issues (see
`TASKS.md`'s newest "pre-context-clear audit" section). Full `tsc`/`eslint`/
`build` gate clean on both apps, re-verified after the fixes. Not committed
yet as of this entry — check `git status` and `git log` to see whether it
was committed/pushed after this was written.**

**2026-08-12 (even later the same day) — Full customer authentication
system built: register/login/logout/forgot-password/reset-password + a
protected dashboard (profile, addresses, orders, change password). The
account icon (previously a 404) now always resolves — to login when
signed out, to the dashboard when signed in. Verified live end-to-end
against the real backend, not just code-inspected. Full detail in
`CHANGELOG.md`'s newest entry and `PROJECT_MEMORY.md`'s "Customer
authentication architecture" section. Not committed yet. Not built this
round: guest-cart merge on login, server-side wishlist sync for logged-in
customers, checkout auto-fill from a saved address — real follow-ups, not
forgotten.**

**2026-08-12 (later still the same day) — Full technical audit (Opus 5
agent). Three real bugs fixed (checkout-blocking cart-drawer link, dead
search sort control, unescaped HTML in order-confirmation emails), two
dead type/field entries removed from `lib/medusa.ts`. Three more issues
found and deliberately left for a real decision, not blind-patched — see
`TASKS.md`'s new "Found by the 2026-08-12 full technical audit" section.
Full detail in `CHANGELOG.md`'s newest entry. Not committed yet.**

**2026-08-12 (later the same day) — Deployment prep for Railway (backend) +
Vercel (storefront) + Supabase (unchanged). Full runbook: `DEPLOYMENT.md`
(new). `railway.json` added and committed. Real SEO bug fixed (hardcoded
placeholder domain in `siteUrl` — would have broken canonical/sitemap/JSON-LD
in production). Nothing deployed yet — this session has no Railway/Vercel
account access (no CLI login, no connected browser). Next session or the
user: follow `DEPLOYMENT.md`'s "Manual steps" to actually create the
projects; once Railway's first deploy succeeds, its public URL is the
`NEXT_PUBLIC_MEDUSA_BACKEND_URL` value for Vercel.**

**2026-08-12 — Supabase RLS lockdown (all 152 tables, verified live) and a
Vercel first-deploy build fix. Full detail in `CHANGELOG.md`'s newest entry;
summary here:**

1. **Supabase security linter warnings (`rls_disabled_in_public`,
   `sensitive_columns_exposed`) are fixed and verified.** Every `public`
   table now has RLS enabled with zero policies (full lockdown) — the
   correct fix here specifically, since no `supabase-js`/PostgREST client
   exists anywhere in this codebase (confirmed by grep) and Medusa's own
   DB role has `BYPASSRLS`, so this closes the Supabase Data API exposure
   gap with zero effect on Medusa. Re-verified live: storefront, Store
   API, and Medusa admin login all work correctly after the change; full
   `tsc`/`eslint`/`next build`/`medusa lint` gate clean.
2. **Vercel deploy is still not possible today — this was a real, user-
   reported build failure, not fixed by code alone.** Root cause (from a
   real Vercel build log): `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` isn't set
   in the Vercel project (matches the earlier "no production environment
   variables configured anywhere" note below) — `app/sitemap.ts` was the
   only route hitting the Medusa Store API at build time and has been
   fixed to degrade gracefully instead of crashing the build, but the
   deployed site still needs, in Vercel's project environment variables:
   `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (from Medusa admin → Settings →
   API Key Management) **and** `NEXT_PUBLIC_MEDUSA_BACKEND_URL` pointing at
   a real, internet-reachable Medusa deployment. **No such deployment
   exists yet** — Medusa only runs as a local dev server on this machine.
   Standing one up (Railway/Render/Fly/DigitalOcean, etc.) is a real
   hosting decision for the user to make; not attempted here.
3. **Not committed/pushed yet** — ask before either, per the project's
   standing rule (the "don't ask per-phase" exception was specific to the
   Admin-first roadmap and is no longer in effect).

**2026-08-11 (continuing the same day's session) — Phases D through K of
the Admin-first platform are all built, verified live against the real
Supabase database, and committed locally. The full A–K roadmap is
complete. Nothing is pushed to `origin/main` since Phase B**
(`origin/main` is still at `b08e8a5`) — per the user's standing
instruction for this roadmap run ("don't ask me continue with all phases
and then push them"), every phase was committed without asking, and
`git push` was deliberately held back until the whole roadmap was done.
**That point has now been reached — ask the user before the final
`git push`**, which was never covered by the "don't ask" instruction
(only the commit chaining was).

1. **Exact state**: the Admin-first platform roadmap (Phases A–K) is
   **complete**. **Check `git status` first thing** — should be clean.
   Local commits for Phases D–K are ahead of `origin/main` and still
   unpushed. **Do not push without asking the user first** — this is the
   one remaining gate from the standing instruction above.
2. **Last completed action**: Phase K (Analytics/Consent) — a new
   `analytics-settings` singleton module (GA4/GTM/Meta Pixel/Clarity IDs,
   all optional, none fabricated), an admin **Analytics** route, and a
   three-piece storefront consent architecture (`consent-storage.ts`
   external store, `ConsentBanner`, `AnalyticsScripts`) that only shows a
   banner when at least one service is configured and only ever injects
   a tracking script after the visitor explicitly accepts. Full detail in
   `CHANGELOG.md`'s "Admin-first platform, Phase K" entry and
   `PROJECT_MEMORY.md`'s matching section. Phases D (Content Pages), E
   (Homepage CMS), F (Product Merchandising, partial — cross-sell
   curation and grid-listing badges deliberately deferred), G (Cart/
   Checkout Marketing Config), H (Search Management), I (Media Library —
   URL-based only, per the user's explicit choice), and J (Campaigns) all
   also complete; see their own `CHANGELOG.md`/`PROJECT_MEMORY.md`
   entries.
3. **Next action to execute**: there is no next roadmap phase — the
   Admin-first platform is done. The immediate next step is procedural,
   not code: **ask the user whether to `git push` now** (local commits
   through Phase K are sitting ahead of `origin/main`, untouched since
   Phase B). Beyond that, see `TASKS.md` → "Next"/"Future" for the honest
   list of what's left in the project overall — a real payment processor
   (still on hold, see §7 below and `PROJECT_MEMORY.md`), account/
   wishlist-mobile-header/content-page follow-ups, and the housekeeping
   list (delete the six `qa-agent`-pattern temporary admin users now that
   the roadmap is done, decide the free-shipping threshold, enter real
   product characteristics data, run axe/Lighthouse for the first time).
   None of these have an open authorization gate blocking them — same
   "not blocked, just not started" status as before this roadmap began.
4. **First files to inspect**: none required to *resume* work (there's
   no in-progress code) — but if asked to extend Phase K specifically
   (a fifth tracking service, a granular per-service consent UI, etc.),
   start from `apps/storefront/src/lib/consent-storage.ts`,
   `apps/storefront/src/components/layout/ConsentBanner.tsx`, and
   `apps/storefront/src/components/layout/AnalyticsScripts.tsx` (the
   three-piece pattern established this phase), plus
   `apps/backend/apps/backend/src/modules/analytics-settings/` for the
   backend side.
5. **Warnings / important context most likely to matter again**:
   - **`.claude/launch.json` already exists and is the deliberate dev-server
     setup — it points at `.claude/dev-backend.cmd`/`dev-storefront.cmd`,
     small wrapper scripts that `cd` into the right directory and prepend
     this machine's portable Node install to `PATH` before running
     `pnpm`.** It does not show up in a `Glob` for `.claude/launch.json`
     (dotfile directories appear to be skipped) — check with `ls`/`Bash`,
     not `Glob`, before concluding it doesn't exist. Phase K's session
     nearly overwrote it with a plain `pnpm --dir <path> run <script>`
     config before noticing via `git status`/`git diff` that the file was
     already tracked and came out modified, not new — caught and reverted
     before committing. **Never regenerate this file from scratch; if a
     `preview_start` config seems to be missing, verify with `git log --
     .claude/launch.json` first.**
   - **This machine's Next.js disk fetch-cache
     (`apps/storefront/.next/cache/fetch-cache/`) can serve stale content
     well past its `revalidate` window, and survives `next dev` restarts**
     — found live this session (again, independently, during Phase K): a
     cleared analytics-settings row still showed the consent banner
     minutes later, confirmed via direct backend `curl` that the database
     itself was already correct. **If an admin-editable value "isn't
     showing up" on the storefront, check the database directly via
     `curl` first** (proves save vs. cache) **before touching application
     code**. If it's a cache issue, `rm -rf apps/storefront/.next/cache`
     and restart the dev server.
   - **`computer` tool clicks on the storefront's cookie-consent banner
     buttons were unreliable in the same way documented below for admin
     login/dropdowns** — a `ref`-targeted click on "Απόρριψη" silently
     didn't register (no error, but `localStorage`/DOM state didn't
     change) even though the same approach worked for "Αποδοχή" moments
     earlier. Worked around by dispatching the click directly via
     `javascript_tool`
     (`[...document.querySelectorAll('button')].find(b =>
     b.textContent.trim() === '<label>').click()`) and confirming the
     result via `localStorage`/DOM inspection. **Treat every `computer`
     click as unverified until confirmed by a follow-up state check** —
     this is not limited to admin-dashboard forms, it recurred on a
     plain storefront button too.
   - **The `read_page` browser tool's synthesized textbox label echoes the
     `placeholder` HTML attribute regardless of the field's real current
     value**, for any input that has one. A field that visually still
     contains old text can misleadingly `read_page` as empty. **Verify a
     form field's true content via a `computer` screenshot, not
     `read_page`'s label, before trusting that a clear/edit actually
     took** — this session had a save silently no-op (caught only by
     checking the backend directly) before switching to screenshot
     verification.
   - **A category listing's canonical-URL admin override must only apply
     on page 1** — `?page=2` and beyond must keep self-canonicalising to
     their own URL regardless of what's in the admin field, or Google sees
     every paginated page as a duplicate of the admin's chosen URL. Any
     future paginated-listing SEO override (if one gets added elsewhere)
     needs the same page-gate, not just a copy of the product/homepage
     pattern.
   - **`MedusaService`'s generated TypeScript types can be wrong for an
     irregular model name** (verified for `"seo"` → real runtime methods
     are `listSeos`/`createSeos`/`updateSeos`, but the generated *types*
     say `Seoes` and `tsc` will confidently suggest the wrong name).
     `site_setting` (Phase C) deliberately used a regular-plural-friendly
     singular model name and hit no such mismatch — but **any new custom
     module should still have its real method names verified via a
     throwaway `medusa exec` script** (inspect the resolved service's
     prototype chain) before trusting `tsc --noEmit` as proof it'll run.
   - **Any admin-editable title field needs `title: { absolute: ... }`
     in the storefront's `generateMetadata`**, not a plain string — Root
     Layout's `"%s | STIA"` template will double up if the admin's value
     already contains the site name.
   - **The `medusa` CLI (`develop`/`exec`/`lint`/`db:generate`/
     `db:migrate`/`build`) has a ~100-150s cold start on this machine** —
     a command that looks hung at a 45-60s timeout may just need longer.
   - **The browser tool's console-log buffer does not clear on same-tab
     navigation** — open a fresh tab to confirm current behavior when
     debugging a live fix, rather than trusting a reused tab's console.
   - Still true from earlier sessions: any `IntersectionObserver`-driven
     "load more" must re-create the observer after every batch (a
     persistently-intersecting sentinel never fires twice); a prop
     crossing a Server→Client Component boundary must be plain data,
     never a closure; any `useSyncExternalStore`-backed store needs
     stable snapshot references.

---

**The rest of this file (sections 1-7 below) is stale/historical** — written
mid-session before several rounds of work landed. Kept for now in case any
narrative detail in it is still useful, but do not treat it as current state.

## 1. Exact last action completed

`origin/main` is fully up to date through `64540dd` — Phase 4 through 4B,
Phase 5 (product code/SKU, search, add-to-cart everywhere), and the
production readiness audit are all committed and pushed. Full history in
`CHANGELOG.md`.

**Then, this session, and left uncommitted on purpose:**

1. User asked for four UX improvements in one brief — reposition the
   product card's Add to Cart button, add a wishlist, make stock status
   always visible, and give the PDP dedicated description/characteristics
   sections — with explicit instruction to inspect the current
   implementation, look briefly at how established Greek home-goods
   retailers structure cards/PDPs (pattern reference only, nothing copied),
   and propose an architecture before writing code.
2. Inspected `ProductCard`/PDP/`lib/types.ts`, live-tested Medusa's Store
   API for product "characteristics" fields (confirmed `material`,
   `weight`, `length`, `width`, `height`, `origin_country` all already
   exist — no new field needed — but all 16 real products have every one
   empty today), and confirmed Medusa has no native wishlist module and
   this storefront has no customer auth system.
3. Full proposal written (`PRODUCT_CARD_WISHLIST_PDP_SPEC.md`), including
   pushing back on part of the user's own first draft: they proposed
   stock/button *before* title/price on the card; recommended the reverse
   (identity/price before the action) and explained why. User took the
   recommendation on both open decisions (card hierarchy, and shipping the
   Characteristics section empty-safe now rather than waiting for real
   spec data).
4. Built: data layer first (characteristics fields, `wishlist-storage.ts`
   as a real external store, `StockStatus` component), then `ProductCard`'s
   redesigned layout, then the PDP (heart icon, stock line, Description/
   Characteristics sections), then `/lista-epithymion`.
5. Full verification, live: wishlist toggle → header count → persistence →
   wishlist page → empty state, all instant, no reload; a real
   out-of-stock test (via the Admin API directly this time — the temporary
   admin dashboard's row-action menu proved unreliable to drive through
   browser automation) confirmed and restored on both card and PDP;
   375/768/1280px all zero horizontal overflow; a real long product name
   wraps cleanly; heading hierarchy and JSON-LD confirmed via
   `document.querySelectorAll`/`JSON.parse`, not assumed from the JSX.
   Found and fixed a real bug along the way (§5 below).
6. All five handoff files updated to reflect the above (this file
   included).

**Check `git status` first thing.** Everything through the audit is
committed and pushed; this session's work is not.

## 2. What "next" actually means here

No unfulfilled "build it" authorization gate is blocking new work. Three
review checkpoints are stacked and still outstanding — checkout (Phase 4B),
Phase 5, and now this session's card/wishlist/PDP work have all been built
and verified from this session's side, but none has had the user's own
hands-on look. Not a blocker to keep building, but say what's actually true
if it comes up rather than assuming a review happened.

See `TASKS.md` → "Future" for the honest list: a real payment processor (on
hold, see §7), account/wishlist-mobile-header/content pages, or
housekeeping (delete three temporary admin users now, decide the
free-shipping threshold, enter real product characteristics data, run
axe/Lighthouse for the first time).

## 3. Which files should be opened first

- `PROJECT_MEMORY.md` — read "Cart architecture," "Checkout architecture,"
  "Product code / add-to-cart-everywhere / search architecture," and
  "Product card / wishlist / stock display / PDP content architecture" in
  order (adjacent, each depends on the one before it).
- `CURRENT_STATE.md` — what's actually built and tested, including this
  session's full verification list and the honest "not tested" list.
- `TASKS.md` — the full roadmap; this session's completed checklist is
  there, plus the audit's still-open "deliberately not fixed" list.
- `PRODUCT_CARD_WISHLIST_PDP_SPEC.md` — the approved design reference for
  card/wishlist/stock/PDP-content decisions (e.g. real product spec data
  arriving, or a real multi-variant product finally existing).
- For anything touching payment: still on hold, see §7 — do not start
  without the user's own processor account and real test keys.

## 4. Which files should NOT be modified

- `apps/backend/apps/backend/src/migration-scripts/initial-data-seed.ts` —
  Medusa's own default seed script; add a new migration rather than
  rewriting one that may already have run.
- `apps/backend/apps/backend/.env` / `apps/storefront/.env.local` —
  gitignored, real secrets/connection strings. Never print contents into
  chat, logs, or a commit.
- The lockfiles (`pnpm-lock.yaml` in either app) — only package-manager
  commands should change them.
- `apps/backend/pnpm-workspace.yaml`'s exclusion of `apps/backend` from the
  root workspace — deliberate, don't "fix" it.
- Don't rename/restructure `lib/types.ts`'s domain types casually — `Cart`,
  `Order`, `Address`/`AddressSummary`, `Product`/`ProductVariant`
  (including the new `characteristics` field) are depended on by the cart,
  checkout, Phase 5, and this session's surfaces.
- `lib/data/cart.ts`'s mapping of `subtotal` from Medusa's `item_subtotal`
  field is deliberate — see `PROJECT_MEMORY.md` for why reverting it would
  silently double-count shipping.
- The mobile order-summary reordering in `CheckoutForm.tsx` uses CSS
  `order-first lg:order-none` with the DOM kept in desktop reading order —
  don't move the JSX position instead.
- `CategoryPLPView`'s `basePath` prop must stay a pure path with no query
  string of its own — pagination/sort links build on top of it with
  `extraParams`.
- **`lib/wishlist-storage.ts`'s `getSnapshot`/`getServerSnapshot` must keep
  returning stable/cached references** — this is not a style choice, a
  fresh array literal each call is a real, confirmed-live React bug
  (infinite-loop warning). If you're tempted to simplify this file, don't,
  without understanding why the caching exists first.
- `ProductCard`'s new layout (image → title → code → price → stock → Add
  to Cart, all in normal document flow) — the previous absolutely-
  positioned hover-reveal design was deliberately retired this session
  after being reviewed and reordered per an explicit user decision; don't
  reintroduce the overlay pattern without a fresh reason.

## 5. Warnings / things to remember

- **Turbopack dev-server HMR goes stale after long edit sessions.** If a
  dev-server error contradicts what `pnpm build` says, `rm -rf .next` and
  restart before assuming the code is wrong.
- **`next build` needs the live Medusa backend** — `ECONNREFUSED` means the
  backend isn't running, not a code bug. Both dev servers need to be
  started fresh each new session (they don't persist across sessions in
  this environment) — `pnpm run backend:dev` from `apps/backend` (~45s to
  boot), `pnpm dev` from the repo root.
- **A Medusa fulfillment service zone's `geo_zones` update via the Admin
  API is a full replace, not an append.**
- **`/store/carts/:id/complete` returns a discriminated union**, not a
  thrown error on failure.
- **Any `useSyncExternalStore`-backed store needs stable snapshot
  references** — see §4 above. This is the newest, most likely to
  resurface if another client-only feature (a "compare" list? a
  recently-purchased list?) gets built the same way.
- **Medusa's Store API already searches variant SKU via `q`**, and already
  exposes real per-variant stock and product attribute fields
  (material/weight/dimensions/origin) — none of these need `+variants.*`/
  top-level field wiring rediscovered; see `lib/data/products.ts`'s
  `PRODUCT_FIELDS` for the current full list.
- **Browser-automation `computer` click/type actions were unreliable
  again this session** (typed credentials silently not landing in login
  fields, a dropdown menu not opening on click) — when a click/type seems
  to silently no-op, verify via `javascript_tool` (check actual field
  values, or dispatch events/clicks directly) before concluding the app
  itself is broken. For anything requiring an authenticated Medusa admin
  session, driving the Admin REST API directly via `curl` with a token
  from `POST /auth/user/emailpass` is faster and more reliable than the
  dashboard UI in this environment.
- **No admin rights on this machine** — see "Environment setup" in
  `PROJECT_MEMORY.md` for portable-install `PATH` prepends if a fresh shell
  is missing Node/gh.

## 6. Known bugs

**None currently open.** Things worth tracking that aren't bugs: three
temporary admin users (`test-agent@stia.gr`, `qa-agent@stia.gr` — password
stopped working this session for unknown reasons, `qa-agent2@stia.gr` —
created as a result) and two real test orders (`display_id` 1, 2) in the
local dev database from live verification work — all harmless, documented
in `PROJECT_MEMORY.md`/`TASKS.md`, cleanup is housekeeping whenever
convenient. A handful of extra items may also sit in leftover guest carts
from repeated quick-add testing across sessions — same category as every
other abandoned test cart already documented, harmless.

## 7. Pending decisions

- **Checkout, Phase 5, and this session's work all still need the user's
  own review** — the actual next step; see section 2 above.
- **Commit this session's card/wishlist/PDP work, and push?** — not
  decided; ask the user rather than assuming either way, same pattern as
  every prior commit/push decision in this project.
- **A real payment processor** (Stripe vs. Viva Wallet) — researched, but
  the user explicitly chose to hold off and set up the processor account
  themselves first. **Do not pick a processor or start integrating on your
  own initiative** — wait for the user to share which one and real
  (test-mode) API keys.
- **ΑΦΜ/ΔΟΥ + receipt-vs-invoice choice** — explicitly out of scope for the
  approved checkout spec; revisit if needed.
- **Free-shipping threshold** — still a placeholder (€50); the cart's
  free-shipping messaging is disabled entirely until a real backend rule
  exists to back it.
- **Real product characteristics data** — the PDP's Characteristics
  section is fully built and will render automatically the moment real
  material/weight/dimensions/origin-country data is entered in the Medusa
  admin for any product; today it renders nothing (correct, not a bug).
- **Reconciling `TrustStrip`/PDP payment copy** — still flagged, not fixed.
- **Backend hosting** — Vercel connected but can't run Medusa's persistent
  server; deferred until actually needed.
- **Real brand name / domain, real product photography** — placeholders,
  no plan yet.
- **A real multi-variant product** — would be the first real test of the
  variant picker, grid-card `Επιλογές` routing, and wishlisting a
  multi-variant product, all currently verified by code inspection only.
- **Wishlist header icon on true mobile widths** — currently `hidden
  sm:block` (matches the pre-existing account icon treatment); the
  heart-toggle interaction itself works everywhere on mobile already, this
  is specifically about the header nav entry point to `/lista-epithymion`.
  Would need a `MobileMenu` change — not done this session, flagged as a
  real gap.
