# Next Steps

## START HERE NEXT SESSION

Read `PROJECT_MEMORY.md`, `CURRENT_STATE.md`, and `TASKS.md` first — this file is
the pointer to exactly where to resume, those three have the detail behind it. Do
not restart the project, do not regenerate completed features, do not re-analyze
the whole codebase from zero — everything needed is in these five files.

1. **Exact phase we are currently in**: Phases 0–5 are built and verified,
   and a **production readiness audit of the whole codebase has just been
   completed** — that audit was explicitly gated ("no further development
   until it's done"), and it is done. Its findings and fixes are in
   `CHANGELOG.md` (newest entry); what it deliberately did *not* fix is in
   `TASKS.md` → "Found by the production readiness audit, deliberately not
   fixed". Checkout (Phase 4B) and Phase 5 both still lack an explicit
   "looks good" from the user — don't narrate either as approved.
2. **Last completed action**: the production readiness audit. Its changes
   are **uncommitted working-tree changes** (29 files, one deletion —
   `components/home/Reviews.tsx`), left that way on purpose for the user to
   review. Phase 5 itself is committed as `a76a8ed`; `3de52dc` is Phase
   4–4B. Nothing has been pushed since `781c132` (Phase 3) — **check
   `git status`/`git log` before assuming otherwise.** A real payment
   processor (Stripe vs. Viva Wallet) was researched but explicitly put on
   hold — the user wants to set up the account themselves first; see §7
   below, do not pick a processor or start integrating without them
   providing real (test-mode) keys.
3. **Next action to execute**: surface the audit's results to the user and
   let them review the working tree before anything is committed. After
   that: committing the audit, pushing to `origin/main` (ask first —
   pushing is a should-confirm action, unlike a local commit), or picking
   from `TASKS.md`. The audit's own "deliberately not fixed" list is the
   most honest source of near-term candidates — the newsletter form's
   silent no-op and the broken multi-provider payment UI are the two with
   real customer impact. Say explicitly what you're doing rather than
   assuming a review happened that didn't.
4. **First files to inspect**: `CHANGELOG.md`'s production-readiness-audit
   entry (the most recent state of the codebase), then `PROJECT_MEMORY.md`
   → "SEO strategy", "UX decisions" and "Cart/Checkout/Product-code
   architecture" sections, `CURRENT_STATE.md`, `TASKS.md`.
5. **Warnings / important context**: see section 5 below. The newest
   things most likely to matter again: **metadata (including
   `alternates.canonical`) is inherited from the root layout**, so every new
   route needs its own canonical or it silently claims to be the homepage;
   and **never disable a form input to signal a background save** — it
   drops focus to `<body>`.

---

**The rest of this file is the detailed version of the five points above.**

## 1. Exact last action completed

Committed on `main` (`781c132`, **the last pushed commit**): Phase 3 (audit
+ real Medusa data wiring). Committed locally, not pushed: `3de52dc` (Phase
4 / 4A / 4A.1 / 4B — related products, recently viewed, the full cart, the
cart clarity revision, checkout) and `a76a8ed` (Phase 5).

**Then, this session, and left uncommitted on purpose: the production
readiness audit.** A gated whole-codebase pass (code review, performance,
SEO, Core Web Vitals, accessibility, Medusa architecture, cleanup, full test
gate) covering Phases 1–5. 29 files changed, one deleted
(`components/home/Reviews.tsx` — three fabricated named customer
testimonials). The single most user-visible fix was a real checkout
keyboard-focus bug measured live; the most consequential judgement call was
deleting the fake reviews section outright rather than softening it. Full
narrative in `CHANGELOG.md`; the honest "found but deliberately not fixed"
list is in `TASKS.md`. The working tree was left dirty so the user can
review it before anything is committed.

Phase 5, for context (now committed as `a76a8ed`):

1. User gave two new requirements in one brief: a permanent unique product
   code (SKU) searchable by code or name, and add-to-cart from every
   product grid in the app (not just the PDP) — with explicit instruction
   to inspect the current implementation and propose an architecture
   before writing any code.
2. Live Store API testing (against the real backend, real 16-product
   catalog) found both features were smaller than they looked: Medusa's
   native `variant.sku` was already the right field (unique, non-null,
   DB-enforced uniqueness — no new field needed), and Medusa's own `q`
   full-text search already indexed both title and SKU together — no new
   search index needed. `ProductCard` was already the one shared card
   component on every product grid; the real gaps were stock-awareness and
   a multi-variant guard, not "add it everywhere."
3. Full architecture written and presented
   (`PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md`). Three open decisions
   presented explicitly rather than assumed; user picked the recommended
   option on all three (route multi-variant products to the PDP rather
   than a speculative inline selector; show the code on the PDP only, not
   grid cards; build both a live search dropdown and a results page).
4. Built: data layer first (`+variants.sku`/`inventory_quantity`/
   `manage_inventory`/`allow_backorder` fields, `isVariantAvailable`,
   `searchProducts`), then `ProductCard`/`AddToCartButton` gating, then the
   search UI (`SearchBox.tsx`, `lib/actions/search.ts`, `/anazitisi`).
5. Full verification: `tsc`/`eslint`/`next build` clean; live search by
   exact SKU, partial SKU, and Greek name; a real out-of-stock test (zeroed
   a product's stock via a temporary admin user, `qa-agent@stia.gr`,
   confirmed `Εξαντλήθηκε` on both the PDP and grid card, restored it);
   quick-add from a grid card confirmed working at a real 375px mobile
   width. Found and fixed a real, separate bug along the way: the
   quick-add button was `display:none` on mobile entirely (a
   desktop-hover-reveal leftover from Phase 4A) — mobile users couldn't
   add to cart from any grid before this fix.
6. All five handoff files updated to reflect the above (this file
   included).

**Check `git status` first thing.** Phase 4–4B (`3de52dc`) and Phase 5
(`a76a8ed`) are committed locally but not pushed; the production readiness
audit is uncommitted in the working tree.

## 2. What "next" actually means here

The audit gate ("no further development until the production readiness
audit is complete") has been satisfied. What's outstanding is the same kind
of checkpoint this project has honored at every phase boundary — the user
reviewing a *result* themselves — now stacked three deep: checkout (Phase
4B) never got an explicit "looks good", Phase 5 didn't either, and the
audit's working-tree changes haven't been reviewed. This isn't a blocker to
keep building, but don't narrate any of them as approved — say what's
actually true (built and verified from this session's side, not yet
reviewed by the user) if it comes up.

See `TASKS.md` → "Found by the production readiness audit, deliberately not
fixed" for the sharpest near-term list (the newsletter form's silent no-op
and the structurally broken multi-provider payment UI are the two with real
customer impact), and → "Future" for the longer roadmap: a real payment
processor (on hold, see §7), account/wishlist pages, footer content pages,
or housekeeping (delete the two temporary admin users, decide the
free-shipping threshold, re-run responsive verification, run axe/Lighthouse
for the first time, etc.).

## 3. Which files should be opened first

- `CHANGELOG.md` — the production readiness audit entry at the top is the
  most current description of the codebase and of what was deliberately
  left alone.
- `PROJECT_MEMORY.md` — read "Cart architecture," "Checkout architecture,"
  and "Product code / add-to-cart-everywhere / search architecture" in
  order (adjacent, each depends on the one before it). Real, non-obvious
  Medusa shapes are documented there — don't re-derive these from scratch
  if they resurface.
- `CURRENT_STATE.md` — what's actually built and tested, including the
  full Phase 5 verification list and the honest "not tested" list.
- `TASKS.md` — the full roadmap; Phase 5's completed checklist is there.
- `PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md` — the approved design reference
  for product code/search/add-to-cart decisions (e.g. a real multi-variant
  product finally existing, which would unblock testing the variant
  picker for real).
- For anything touching payment: `lib/actions/checkout.ts`'s
  `completeCheckoutAction` — the provider ID is read live from
  `/store/payment-providers`, never hardcoded, so adding a real processor
  is mostly a backend/config change, not a storefront redesign. But see §7
  — don't start this without the user's own processor account.

## 4. Which files should NOT be modified

- `apps/backend/apps/backend/src/migration-scripts/initial-data-seed.ts` —
  Medusa's own default seed script; add a new migration rather than
  rewriting one that may already have run.
- `apps/backend/apps/backend/.env` / `apps/storefront/.env.local` —
  gitignored, real secrets/connection strings. Never print contents into
  chat, logs, or a commit. Edit `.env.template`/`.env.example` instead when
  documenting a new required variable.
- The lockfiles (`pnpm-lock.yaml` in either app) — only package-manager
  commands should change them.
- `apps/backend/pnpm-workspace.yaml`'s exclusion of `apps/backend` from the
  root workspace — deliberate, don't "fix" it.
- Don't rename/restructure `lib/types.ts`'s domain types casually — `Cart`,
  `Order`, `Address`/`AddressSummary`, `Product`/`ProductVariant` are now
  depended on by the cart, checkout, and Phase 5 (product code/search)
  surfaces.
- `lib/data/cart.ts`'s mapping of `subtotal` from Medusa's `item_subtotal`
  field is deliberate, not a simplification opportunity — see
  `PROJECT_MEMORY.md` for exactly why reverting it would silently
  double-count shipping.
- The mobile order-summary reordering in `CheckoutForm.tsx` uses CSS
  `order-first lg:order-none` with the DOM kept in desktop reading order —
  don't "simplify" this by moving the JSX position instead; that exact
  change broke the desktop layout once already.
- `CategoryPLPView`'s `basePath` prop must stay a pure path with no query
  string of its own (`/anazitisi`, not `/anazitisi?q=...`) — pagination/
  sort links build on top of it with `extraParams`; a query-string
  `basePath` would produce a malformed double-`?` URL.
- `ProductCard`'s quick-add/`Επιλογές` button classes: the mobile-visible-
  by-default / desktop-hover-reveal split (`flex ... md:opacity-0
  md:group-hover:opacity-100`) is deliberate — collapsing it back to a
  single `hidden md:flex` would silently reintroduce the "unusable on
  mobile" bug this session found and fixed.
- Don't reintroduce `disabled={saving}` on checkout's email/contact/address
  `FormField`s — it drops keyboard focus to `<body>` mid-form. The
  `role="status"` "Αποθήκευση…" label on `SectionHeading` is the
  replacement, and `FormField` no longer has a `disabled` prop at all.
- Don't drop the per-route `alternates.canonical` on `/anazitisi` or
  `/checkout/epibebaiosi`, and don't "simplify" `canonicalListingPath()`
  away — without them those routes inherit the root layout's
  `canonical: "/"` and claim to be the homepage.
- Don't re-add `role="menu"`/`role="menuitem"` to the desktop mega menu, and
  don't turn its trigger's `onClick` back into a toggle (see §5).
- Don't restore `components/home/Reviews.tsx` with invented testimonials, or
  re-add card/Viva Wallet payment claims to `TrustStrip`, the PDP delivery
  block, or the footer badge row — checkout can only do "Αντικαταβολή".

## 5. Warnings / things to remember

- **Turbopack dev-server HMR goes stale after long edit sessions.** If a
  dev-server error contradicts what `pnpm build` says, `rm -rf .next` and
  restart before assuming the code is wrong.
- **`next build` needs the live Medusa backend** — a build failure with
  `ECONNREFUSED` means the backend isn't running, not a code bug. Most
  routes are dynamically rendered (`ƒ`), including the homepage — expected,
  not a regression.
- **A Medusa fulfillment service zone's `geo_zones` update via the Admin
  API is a full replace, not an append** — `POST /admin/fulfillment-sets/
  :id/service-zones/:id` needs the *entire* desired `geo_zones` array, or
  it'll silently drop whichever countries you don't include.
- **`/store/carts/:id/complete` returns a discriminated union**, not a
  thrown error on failure — `{type:"order", order}` on success (the real
  order comes back directly, no need to re-fetch), `{type:"cart", cart,
  error}` on a workflow-level failure. Code defensively for both branches.
- **`innerText` (and therefore `get_page_text`/`read_page`'s text output)
  follows DOM order, not CSS `order`.** If verifying a CSS-`order`-based
  responsive reorder, check real `getBoundingClientRect()` positions.
- **`blur` doesn't bubble; React's `onBlur` actually listens for
  `focusout`.** When driving a form via `element.dispatchEvent(...)` in
  browser automation, dispatch `new FocusEvent('focusout', {bubbles:true})`,
  not `new Event('blur', {bubbles:true})`.
- **Correction (Phase 5): the Store API *does* expose real per-variant
  stock** — an earlier phase's note claiming `+variants.inventory_quantity`
  was silently ignored was wrong (or no longer true). Fetch it explicitly
  with `+variants.inventory_quantity,+variants.manage_inventory,
  +variants.allow_backorder` — it's not returned by default. See
  `PROJECT_MEMORY.md` for the full corrected note and the availability rule
  now used (`isVariantAvailable`).
- **Medusa's own `/store/products?q=` already searches variant SKU, not
  just title/description** — confirmed live. Don't build a separate search
  index or duplicate this matching logic; `searchProducts()` in
  `lib/data/products.ts` is the one place this lives.
- **Browser-automation `computer` click actions were unreliable this
  session** (timed out/hung on a mobile-viewport click that, per
  `getComputedStyle`/cart-count checks afterward, may have actually
  registered) — if a click seems to hang or silently no-op, verify via
  `javascript_tool` (`element.click()` + checking the resulting state)
  before concluding the app itself is broken.
- **Next.js metadata is inherited from the root layout, `alternates`
  included.** A route that declares no `alternates` emits the root layout's
  `canonical: "/"` — it tells crawlers it *is* the homepage. This was a real
  shipped bug on `/anazitisi` and `/checkout/epibebaiosi`, found only by
  reading the rendered HTML. Give every new route its own canonical, even a
  noindex one.
- **Never use `disabled` to indicate a background save on a form input.**
  Disabling a focused element moves focus to `<body>`; an autosave firing on
  blur then destroys the customer's keyboard position. Announce saving state
  instead (`role="status"` on `SectionHeading`).
- **A `robots.txt` `Disallow` prevents the `noindex` meta tag from ever
  being read.** Pick one per route: `/anazitisi` uses `noindex` and is
  deliberately absent from `robots.ts`; `/kalathi` and `/checkout` are
  robots-blocked.
- **The mega-menu trigger opens, it does not toggle** — a mouse click
  arrives after `mouseenter`/`onFocus` have already opened the panel, so a
  toggle closes it under the cursor. Caught live as a self-introduced
  regression during the audit.
- **No admin rights on this machine** — see "Environment setup" in
  `PROJECT_MEMORY.md` for exact portable-install `PATH` prepends if a fresh
  shell is missing Node/gh.
- Both apps need to be running to see the full site working:
  `pnpm run backend:dev` from `apps/backend`, `pnpm dev` from the repo root
  (or the `backend`/`storefront` entries in `.claude/launch.json` with the
  preview tools). The backend takes **~45 seconds** to boot to "Server is
  ready" — don't judge it broken before then. Per explicit user preference,
  **leave both dev servers running by default** between turns rather than
  stopping them.

## 6. Known bugs

**No unfixed defects in shipped user flows.** The production readiness
audit's own "found but deliberately not fixed" list (`TASKS.md`) is the
honest exception list — the two with real customer impact are the
newsletter form silently no-opping on submit, and `PaymentSection`'s
multi-provider UI being structurally broken (harmless only because exactly
one provider exists today). Both need a decision, not a code fix.

Things worth tracking that aren't bugs: two
temporary admin users (`test-agent@stia.gr`, `qa-agent@stia.gr`) and two
real test orders (`display_id` 1, 2) in the local dev database from live
verification work — all harmless, documented in `PROJECT_MEMORY.md`/
`TASKS.md`, cleanup is housekeeping whenever convenient, not urgent. A
handful of extra items may also sit in leftover guest carts from this
session's quick-add testing (mobile grid card, PDP) — same category as
every other abandoned test cart already documented, harmless.

## 7. Pending decisions

- **Checkout review, and now Phase 5 review too** — the actual next step;
  see section 2 above.
- **Commit Phase 5, and push everything to `origin/main`?** — not decided;
  ask the user rather than assuming either way. Phase 4 through 4B is
  already committed locally (`3de52dc`) but still not pushed.
- **A real payment processor** (Stripe vs. Viva Wallet) — researched this
  session (see `CHANGELOG.md`/`PROJECT_MEMORY.md` for the comparison), but
  the user explicitly chose to hold off and set up the processor account
  themselves first. **Do not pick a processor or start integrating on your
  own initiative** — wait for the user to share which one and real
  (test-mode) API keys.
- **ΑΦΜ/ΔΟΥ + receipt-vs-invoice choice** — explicitly out of scope for the
  approved checkout spec (no business decision on it yet); revisit if
  needed.
- **Free-shipping threshold** — still a placeholder (€50); the cart's
  free-shipping messaging is currently disabled entirely (not just
  unconfigured) until a real backend rule exists to back it — see
  `PROJECT_MEMORY.md`.
- ~~**Reconciling `TrustStrip`/PDP payment copy**~~ — **done** in the
  production readiness audit, along with a third, previously undocumented
  instance in the footer's payment-badge row. All three now say only
  "Αντικαταβολή". Re-open when a real processor is configured.
- **Review the production readiness audit's working-tree changes** — 29
  files, one deletion, left uncommitted on purpose. The judgement call most
  worth a second opinion: deleting the homepage's fabricated customer
  reviews section outright rather than keeping it as a placeholder.
- **Backend hosting** — Vercel connected but can't run Medusa's persistent
  server; deferred until actually needed (prior explicit user decision).
- **Real brand name / domain** — "STIA" / `stia.gr` are placeholders, never
  trademark-checked.
- **Real product photography** — no plan yet for sourcing it.
- **A real multi-variant product** — would be the first real test of
  Phase 5's variant picker (`AddToCartButton`) and grid-card `Επιλογές`
  routing, both currently verified by code inspection only.
