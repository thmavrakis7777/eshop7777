# Next Steps

## START HERE NEXT SESSION

Read `PROJECT_MEMORY.md`, `CURRENT_STATE.md`, and `TASKS.md` first — this file is
the pointer to exactly where to resume, those three have the detail behind it. Do
not restart the project, do not regenerate completed features, do not re-analyze
the whole codebase from zero — everything needed is in these five files.

1. **Exact phase we are currently in**: Phase 5 (permanent unique product
   code / SKU, add-to-cart from every product grid, search by name or
   code) is **built and verified**, including a live out-of-stock test via
   the admin. Same pattern as every prior phase: spec proposed and
   approved (`PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md`) before any code, then
   built, then verified live. Checkout (Phase 4B) is still sitting behind
   the user's own instruction to review it themselves before moving on —
   that checkpoint has **not** been explicitly cleared yet, it's just no
   longer the only thing waiting; Phase 5 landed in the same session
   without an explicit "checkout looks good" from the user first, at their
   own direction ("it's ok continue").
2. **Last completed action**: Phase 4 through 4B (related products,
   recently viewed, full cart, cart clarity revision, checkout) was
   **committed to local `main` this session** as `3de52dc` — **not pushed**
   to `origin/main` (last pushed commit is still `781c132`, Phase 3). Then
   Phase 5 was designed, built, and verified on top of that, but is **not
   yet committed** — check `git status`/`git log` before assuming otherwise.
   A real payment processor (Stripe vs. Viva Wallet) was researched but
   explicitly put on hold — the user wants to set up the account
   themselves first; see §7 below, do not pick a processor or start
   integrating without them providing real (test-mode) keys.
3. **Next action to execute**: no unfulfilled build-approval gate is
   blocking new work — "next" is genuinely open. But two review checkpoints
   are still outstanding and worth surfacing to the user rather than
   silently building past them again: (a) checkout (Phase 4B) still hasn't
   had its own explicit "looks good" from the user, (b) neither has Phase
   5. If the user gives another "continue"-style go-ahead: reasonable
   next candidates are committing Phase 5, pushing to `origin/main` (ask
   first — pushing is a should-confirm action, unlike a local commit), or
   picking the next item from `TASKS.md` → "Future" (account/wishlist
   pages, content pages, or the payment processor once the user has an
   account). Say explicitly what you're doing rather than assuming a
   review happened that didn't.
4. **First files to inspect**: `PROJECT_MEMORY.md` → "Product code /
   add-to-cart-everywhere / search architecture" (right after "Checkout
   architecture" — read all three cart/checkout/Phase-5 sections, Phase 5
   depends on the cart's `ProductCard`/`AddToCartButton` foundation),
   `CURRENT_STATE.md`, `TASKS.md`, then `PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md`
   if revisiting a Phase 5 UI decision.
5. **Warnings / important context**: see section 5 below — the corrected
   inventory-quantity finding (an earlier phase's note that per-variant
   stock wasn't readable via the Store API was wrong) and the
   `CategoryPLPView` `basePath`-must-be-query-free contract are the two new
   things most likely to matter again.

---

**The rest of this file is the detailed version of the five points above.**

## 1. Exact last action completed

Committed on `main` (`781c132`): Phase 3 (audit + real Medusa data wiring).
Committed on `main` this session (`3de52dc`, **local only, not pushed**):
Phase 4 (related products, recently viewed), Phase 4A (the full cart), Phase
4A.1 (cart clarity revision), and Phase 4B (checkout) — see the previous
session's `CHANGELOG.md` entries for the full story on each.

Then, this session, **not yet committed**, Phase 5:

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

**Check `git status` first thing.** Phase 4 through 4B is committed
locally but not pushed; Phase 5 isn't committed at all yet.

## 2. What "next" actually means here

No unfulfilled "build it" authorization gate is blocking new work right
now. What's outstanding is the same kind of checkpoint this project has
honored at every phase boundary — the user reviewing a *result* themselves
— stacked twice: checkout (Phase 4B) never got an explicit "looks good"
before Phase 5 started (the user said "it's ok continue" without
specifically reviewing checkout first), and now Phase 5 is in the same
position. This isn't a blocker to keep building, but don't narrate it as
"checkout is approved" or "Phase 5 is approved" — say what's actually true
(built and verified from this session's side, not yet reviewed by the
user) if it comes up.

See `TASKS.md` → "Future" for the honest list of what's next: a real
payment processor (on hold, see §7), account/wishlist pages, footer content
pages, or housekeeping (delete the two temporary admin users, decide the
free-shipping threshold, re-run responsive verification, etc.).

## 3. Which files should be opened first

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

**None currently open.** Things worth tracking that aren't bugs: two
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
- **Reconciling `TrustStrip`/PDP payment copy** — both still claim "Κάρτα,
  Viva Wallet ή αντικαταβολή," which overclaims relative to what checkout
  can actually offer today. Flagged, not fixed.
- **Backend hosting** — Vercel connected but can't run Medusa's persistent
  server; deferred until actually needed (prior explicit user decision).
- **Real brand name / domain** — "STIA" / `stia.gr` are placeholders, never
  trademark-checked.
- **Real product photography** — no plan yet for sourcing it.
- **A real multi-variant product** — would be the first real test of
  Phase 5's variant picker (`AddToCartButton`) and grid-card `Επιλογές`
  routing, both currently verified by code inspection only.
