# Next Steps

## START HERE NEXT SESSION

Read `PROJECT_MEMORY.md`, `CURRENT_STATE.md`, `TASKS.md`, and `ADMIN_GUIDE.md`
first — this file is the pointer to exactly where to resume, those four have the
detail behind it. Do not restart the project, do not regenerate completed
features, do not re-analyze the whole codebase from zero — everything needed is
in these files. **Sections 1-7 below this point are historical/stale** (written
mid-way through an earlier session) — trust this summary and `CHANGELOG.md`
over that old detailed body if they ever disagree.

**2026-08-11 (end of a very long session) — `origin/main` is fully
committed and pushed through the "Admin-first platform, Phase A" commit.**
In order, this session: (1) Dynamic New Arrivals + infinite scroll +
homepage carousels, (2) a cart price/discount column-alignment fix
verified against a real Medusa sale, (3) a full technical audit (found and
fixed one real bug — a missing `data-scroll-behavior="smooth"` causing
animated scroll on every route transition — everything else audited
clean), (4) **Phase A of a new, much larger "Admin-first platform"
initiative** — the user's newest ask, explicitly scoped as ~11 phases (see
`TASKS.md` → "Admin-first platform" for the full roadmap). All four are
committed and pushed. **The user is about to clear context and will return
to continue with Phase B onward** — this file exists specifically for that
handoff.

1. **Exact phase we are currently in**: Phase A (Product SEO) of the
   Admin-first platform is done, verified live against the real Supabase
   database, and pushed. **Phase B (Category SEO + Homepage SEO) has not
   been started.** No build-approval gate is currently blocking — Phase A
   was pre-approved as part of the overall roadmap, and the user said "go
   ahead with phase A" without requiring a separate spec round-trip: same
   pattern likely applies to Phase B, but per this project's standing rule,
   confirm before starting real code rather than assuming silence means go.
2. **Last completed action**: Phase A end-to-end — new `seo` custom Medusa
   module (`apps/backend/src/modules/seo`), a product-detail admin widget,
   shared `/admin/seo` + `/store/seo` routes behind a proper workflow, and
   storefront `generateMetadata`/JSON-LD wiring with fallback. Two real
   bugs found and fixed live (a `MedusaService` compile-time/runtime
   method-name mismatch, and a title-template doubling) — full detail in
   `CHANGELOG.md`'s "Admin-first platform, Phase A" entry and
   `PROJECT_MEMORY.md`'s matching architecture section.
3. **Next action to execute**: start Phase B (Category SEO + Homepage
   SEO) — reuses Phase A's exact `seo` module/routes, just needs a second
   admin widget (`product_category.details.side.after` zone) and a
   homepage-settings admin route (homepage has no underlying Medusa
   entity, so it can't use a widget zone — needs a genuine custom admin
   route under `src/admin/routes/`, not yet built). See `TASKS.md` for the
   full Phase B→K roadmap and what each later phase actually requires
   architecturally.
4. **First files to inspect**: `PROJECT_MEMORY.md`'s "Admin-first
   platform, Phase A" section (architecture + the two bugs, in detail),
   `ADMIN_GUIDE.md` (what's already admin-editable), `TASKS.md` → "Admin-
   first platform" (the roadmap).
5. **Warnings / important context most likely to matter again**:
   - **`MedusaService`'s generated TypeScript types can be wrong for an
     irregular model name** (verified for `"seo"` → real runtime methods
     are `listSeos`/`createSeos`/`updateSeos`, but the generated *types*
     say `Seoes` and `tsc` will confidently suggest the wrong name). Any
     new custom module should have its real method names verified via a
     throwaway `medusa exec` script (inspect the resolved service's
     prototype chain) before trusting `tsc --noEmit` as proof it'll run.
   - **Any admin-editable title field needs `title: { absolute: ... }`
     in the storefront's `generateMetadata`**, not a plain string — Root
     Layout's `"%s | STIA"` template will double up if the admin's value
     already contains the site name.
   - **The `medusa` CLI (`develop`/`exec`/`lint`/`db:generate`/
     `db:migrate`/`build`) has a ~100-150s cold start on this machine** —
     a command that looks hung at a 45-60s timeout may just need longer.
   - **The browser tool's console-log buffer does not clear on same-tab
     navigation** — open a fresh tab or check `read_network_requests`
     status codes, not the console, to confirm current behavior when
     debugging a live fix.
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
