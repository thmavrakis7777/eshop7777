# Changelog

Notable changes, newest first. Written for whoever (human or agent) picks this up
next — focus on *why*, not just *what*.

## Phase 5 — Product code (SKU), add-to-cart everywhere, search (2026-08-08)

User brief: every product needs a permanent, unique product code, searchable
by code or name; and add-to-cart must work from every product grid in the
app, not just the PDP. Explicit instruction to inspect the current
implementation and propose an architecture before writing any code — written
up and approved as `PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md`.

**Both features turned out to be smaller than they looked**, because Medusa
and the existing codebase already did most of the work — this is the finding
that shaped the whole approach, not an assumption going in:

- **Product code = Medusa's native `variant.sku`, not a new field.** Live
  Store API testing found all 16 real products already carry unique,
  non-null SKUs, and Medusa enforces SKU uniqueness at the database level
  itself. No custom identifier, no custom uniqueness validation.
- **Search = Medusa's own `q` full-text search, not a new search index.**
  Live-tested `/store/products?q=` and confirmed it already indexes *both*
  title and variant SKU together (exact SKU, partial SKU, Greek title word
  all matched correctly). The gap was purely storefront-side: the header's
  search input has existed since Phase 1 but was never wired to anything.
- **Add-to-cart infrastructure already existed** — `ProductCard` was already
  the one shared card component rendering on every product grid in the app,
  and its quick-add already used the toast (not the drawer) and already
  revalidated cart count/totals immediately. The real gaps were narrower
  than "add it everywhere": no stock-awareness (inventory hardcoded to `1`
  sitewide) and no multi-variant guard (blindly added `variants[0]`).

**What was built**: `+variants.sku`/`inventory_quantity`/`manage_inventory`/
`allow_backorder` added to the product fetch and mapped into
`ProductVariant.code`/`.isAvailable`; `Κωδικός προϊόντος` shown on the PDP
only (not grid cards, by design — keeps grids uncluttered); `ProductCard`
and `AddToCartButton` now gate on real availability (`Εξαντλήθηκε`, disabled)
and variant count (`>1` variants routes to the PDP via an `Επιλογές` link on
grid cards, or a plain radio-group picker on the PDP itself — an inline
popover selector on grid cards was deliberately not built, since no real
multi-variant product exists yet to design or verify one against);
`searchProducts()` + a debounced header dropdown + a `/anazitisi` results
page (reusing `CategoryPLPView`, which gained `extraParams`/`emptyMessage`
props to support a non-category listing without breaking the existing
category pages).

**A real, separate bug found during verification, unrelated to the original
ask**: the quick-add/`Επιλογές` button was `hidden` below Tailwind's `md`
breakpoint — a leftover desktop-hover-reveal pattern from Phase 4A. On an
actual mobile viewport this meant `display: none`, not just "less
discoverable" — mobile users could not add to cart from *any* product grid
before this fix, despite the feature otherwise working. Confirmed via
`getComputedStyle()` before and after, not just visually. Fixed by making
the control unconditionally visible below `md`, hover-reveal preserved only
at `md+`.

**Also corrected a stale note in `PROJECT_MEMORY.md`**: an earlier phase's
finding that `+variants.inventory_quantity` was "silently ignored" by the
Store API turned out to be wrong (or no longer true) — re-tested live and it
returns real per-variant stock. The reactive `insufficient_inventory`
handling in `lib/actions/cart.ts` stays in place either way; the new
UI-layer availability flag is a prediction of the same rule Medusa enforces,
not a replacement for the real check.

**Verified live against the real backend**: search by exact SKU, partial
SKU, and Greek product name (both the header dropdown and `/anazitisi`);
product code displays correctly on the PDP; zeroed a real product's stock
via the admin (temporary `qa-agent@stia.gr` user, same pattern as Phase 4A's
`test-agent@stia.gr`) and confirmed `Εξαντλήθηκε` on both the PDP and grid
card, then restored it; quick-add from a grid card confirmed working at a
real 375px mobile viewport (cart badge incremented, no drawer auto-opened).
`tsc`/`eslint`/`next build` all clean. Not re-verified this session:
discounted-product and coupon-after-quick-add behavior (no active promotion
exists in the live catalog right now, and neither code path was touched by
this phase) — see `PROJECT_MEMORY.md` for the full honest list.

## Phase 4B — Checkout, build (2026-08-08)

Follows directly from the research/groundwork entry below (same day) — that
pass resolved three decisions (shipping zone gap fixed, free-shipping promise
softened, payment method decided as "Αντικαταβολή") before any UI code; this
entry covers the actual build.

**A fourth, more subtle finding, only surfaced by the dry-run itself**: after
setting a real shipping method on a test cart and re-fetching it, Medusa's
`cart.subtotal` turned out to silently include `shipping_total` (and to be
*pre*-discount, unlike `total`) — `item_subtotal` is the field that's
actually items-only. This had been wrong in the **already-shipped** cart
(Phase 4A/4A.1) the whole time, just invisible, because no cart had ever had
a real shipping method before checkout existed to set one. Fixed by
switching `lib/data/cart.ts`'s "Υποσύνολο" mapping to `item_subtotal`,
adding `shippingTotal`/`hasShippingMethod` to the `Cart` domain type, and
updating `CartTotals` to show the real shipping amount once a method is set
instead of always saying "Υπολογίζεται στο checkout" — the same component
now correctly serves both the cart and checkout's order summary.

**What was built**: a single scrolling checkout page (`/checkout`), not a
multi-step wizard — numbered sections (Email → Στοιχεία παραλήπτη →
Διεύθυνση παράδοσης → Τρόπος αποστολής → Πληρωμή), each auto-saving to the
same Medusa cart as the customer fills them in
(`lib/actions/checkout.ts`), shipping options resolved live once the
address is complete, real-time order summary updates as shipping is
selected. Order completion is a real 3-step Medusa flow (payment collection
→ payment session → cart complete), each endpoint verified live before
being coded against — found that `/store/carts/:id/complete` returns a
discriminated union (`{type:"order"}` on success, with the real order
returned directly; `{type:"cart", error}` on a workflow failure, not a
thrown HTTP error) and that guest order lookup by ID works with just the
publishable key, which is what makes the confirmation page
(`/checkout/epibebaiosi`) a real, refreshable/bookmarkable URL rather than
a modal. Cart → checkout CTA relabeled `ΟΛΟΚΛΗΡΩΣΗ ΑΓΟΡΑΣ`; final submit is
deliberately different wording, `ΟΛΟΚΛΗΡΩΣΗ ΠΑΡΑΓΓΕΛΙΑΣ` with the total on
the button itself, partly for clarity and partly because the EU Consumer
Rights Directive requires an order button to unambiguously convey a
payment obligation (`CHECKOUT_UX_SPEC.md` §16).

**Two more real bugs, found only by clicking through the built UI — neither
caught by `tsc`/`eslint`**:

- Email/address/shipping background saves originally shared one
  `useTransition` with the final-submit button, so the submit button
  flashed "Επεξεργασία…" (reading as "your order is processing") while the
  address was just autosaving in the background. Fixed by giving the final
  submit its own dedicated transition, separate from each section's own
  `*Saving` boolean.
- An early attempt to move the order summary above the form on mobile
  changed its *DOM* position instead of using CSS `order` — this fixed
  mobile but silently swapped the desktop two-column layout's sides too
  (form and summary traded places), since with no explicit `order` at the
  desktop breakpoint both columns fell back to DOM order. Fixed by
  restoring DOM order to match the desktop reading order and using
  `order-first lg:order-none` for a mobile-only visual reorder instead.
  Caught by comparing real `getBoundingClientRect()` positions — `innerText`
  (and therefore `get_page_text`) follows DOM order, not CSS `order`, so it
  had looked "wrong" even after the fix was actually correct, and would
  have looked "right" during the broken desktop-swap state. Worth
  remembering: don't trust text-order tools to verify a CSS-`order`-based
  layout, check real positions.

**Verified with a real completed order through the actual UI**, not just
direct API calls: added a product, filled the checkout form, triggered
invalid-email/invalid-phone/invalid-postal-code inline errors (confirmed
they only show for fields actually reached, not the whole form up front),
corrected them, watched real shipping options resolve live with real Greek
delivery-estimate translations ("Παράδοση σε 2-3 εργάσιμες" /
"Παράδοση εντός 24 ωρών" — real backend `type.code` values translated, not
invented), selected one and watched the order summary update in place,
submitted, landed on the confirmation page with a real order number,
confirmed the cart was cleared afterward (cookie deleted, header badge back
to 0), confirmed the confirmation page survives a hard refresh, confirmed
an empty cart at `/checkout` redirects to `/kalathi`, confirmed 375/768/1280
widths all have zero horizontal scroll and the mobile submit bar is a real
`position: fixed` element pinned to the exact viewport bottom edge.
`tsc`/`eslint`/`next build` all clean throughout. Two real orders now exist
in the local dev database from this verification (harmless, local only).

## Phase 4B checkout research — groundwork fixes applied before design approval (2026-08-08)

Before proposing a checkout design (`CHECKOUT_UX_SPEC.md`), tested the actual
Medusa checkout-adjacent endpoints live rather than assuming — same discipline
as every prior phase. Found three things that would have made a well-designed
checkout UI meaningless, presented them to the user as explicit decisions (not
silently resolved), and applied the two that were pure groundwork (not
checkout code itself) once decided:

- **Greece was missing from the shipping service zone.** Confirmed live:
  querying `/store/shipping-options` for a cart with a Greek shipping address
  returned zero options, while a German address on the same cart returned
  both configured options normally. The fulfillment set's service zone had
  the exact 7-country leftover set from Medusa's demo seed (`gb, de, dk, se,
  fr, es, it`) — Greece was added to the sales region and tax region back in
  Phase 2/3, but never to this separate fulfillment subsystem, because
  nothing before now ever exercised "resolve shipping options for a real
  address." **Fixed** via the Admin API (added a `gr` geo_zone to the
  existing service zone) and reverified live. Same bug class as the Phase 2
  "region didn't include Greece" fix, different subsystem.
- **The free-shipping promise wasn't backed by a real rule**, in two places,
  not one: `FreeShippingProgress` (the cart's progress bar, correctly reading
  its own `€50` config) and — found while investigating this —
  `AnnouncementBar` (the sitewide banner on every page) independently
  hardcoded a *different*, mismatched "δωρεάν αποστολή άνω των 39€" claim.
  Neither was backed by an actual conditional shipping rule (both real
  Medusa shipping options are flat-rate, confirmed live). Per explicit user
  decision, **softened rather than backed with a real rule for now**:
  `FreeShippingProgress` disabled behind a module-level flag (component and
  config left intact, not deleted — flip one boolean once a real rule
  exists), `AnnouncementBar`'s claim removed entirely (kept the truthful half
  of that banner, "Παραδόσεις σε όλη την Ελλάδα").
- **Only one payment provider is configured**: `pp_system_default`, Medusa's
  generic manual/system provider — no Stripe/Viva Wallet/Everypay exists
  today, confirmed live via `/store/payment-providers`. Also found: both
  `TrustStrip` (homepage) and the PDP's delivery-info block already say
  "Κάρτα, Viva Wallet ή αντικαταβολή," written as aspirational placeholder
  copy in earlier phases before any provider was configured — flagged as
  needing reconciliation once checkout implementation starts, not fixed yet
  (out of scope for this research pass). Per explicit user decision, the
  checkout design presents this one real method as **"Αντικαταβολή"** (Cash
  on Delivery) rather than something checkout can't actually deliver.

Full checkout UX proposal — structure, wireframes, exact Greek labels, error
states, competitor analysis — is in `CHECKOUT_UX_SPEC.md`, awaiting final
approval to begin implementation. `tsc`/`eslint` clean after the two applied
fixes above.

## Cart desktop table layout bug fix (2026-08-08)

User reported the product title visually appearing under/associated with the
`ΑΡΧΙΚΗ ΤΙΜΗ` column on the full cart page's desktop table. The DOM structure
was already correct — this was a real CSS layout bug, not a data-association
issue, found by measuring actual computed styles and bounding rects rather
than guessing from text-only tool output (which linearizes DOM order and
can't reveal a visual overlap).

**Root cause**: `CartLineItemTableRow`'s grid used `minmax(0,1fr)` for the
`ΠΡΟΪΟΝ` column. Measured live: inside the full page's two-column layout
(items + a 380px summary sidebar), the four fixed price/quantity columns
plus their `gap-6` gutters already consumed nearly all the available width
at common laptop sizes, leaving the `1fr` column as little as **22px**.
Since the product image is `shrink-0` (112px, deliberately non-shrinkable),
it and the title overflowed that near-zero column and visually spilled onto
`ΑΡΧΙΚΗ ΤΙΜΗ` next to it.

**Fix, in three parts** (`cart-table-grid.ts`, `CartTableHeader.tsx`,
`CartLineItemTableRow.tsx`, `CartPageView.tsx`):

1. `ΠΡΟΪΟΝ`'s column changed from `minmax(0,1fr)` to `minmax(14rem,1fr)` — a
   real guaranteed floor instead of an unbounded zero — and the column gaps
   tightened from `gap-6` to `gap-4` to reclaim width.
2. The header and every row now share one `overflow-x-auto` wrapper, so if
   a viewport is ever too narrow to fit all five columns at that floor
   width, the table scrolls horizontally as one synchronized unit instead
   of any column ever being forced below a readable size.
3. The wrapper's grid-item ancestor got `min-w-0` — **load-bearing**, not
   decorative: without it, a CSS grid item's automatic minimum width is its
   content's min-content size, so the table's natural width would bubble up
   and force the *entire page* wider than the viewport instead of being
   contained by `overflow-x-auto`. Found this as a self-introduced
   regression while fixing the original bug — confirmed via
   `document.documentElement.scrollWidth` before shipping the fix.

**A second, subtler self-introduced regression, found and reverted before
shipping**: an initial attempt added `min-w-max` to the header, the row, and
their wrapper to "guarantee" the overflow-scroll fallback would trigger.
This broke column alignment worse than the original bug — `min-w-max`
forces *max-content* sizing, which measures each independent grid instance
against *its own* content only. The header's `ΠΡΟΪΟΝ` cell (just the short
label "ΠΡΟΪΟΝ") and a row's `ΠΡΟΪΟΝ` cell (an actual unwrapped product title)
computed *different* pixel widths for what's supposed to be the same
column, since header and rows are separate grid containers, not literal
`<table>` rows that share one table-layout box model. Removed `min-w-max`
entirely; without it, every grid instance sizes deterministically against
the shared container width (not its own content), so header and rows
compute identical column widths whether that means normal `1fr`
distribution or an identical floored-out overflow — confirmed by comparing
`getComputedStyle(...).gridTemplateColumns` across the header and multiple
rows at 1024px (the tightest width the table shows at, right at the `lg`
breakpoint), 1105px, 1280px, and 1440px.

**Verified**: `tsc`/`eslint`/`next build` clean. Live in-browser, using
real bounding-rect measurements (not just DOM/text order) to actually prove
no overlap: a real Medusa sale price list for a long-named product
("Σετ Εργαλείων Μαγειρικής Σιλικόνης 6 τεμ.", 41 characters) alongside a
non-discounted product in the same cart — confirmed the title's right edge
sits clear of the `ΑΡΧΙΚΗ ΤΙΜΗ` column's left edge at every tested width,
confirmed the header's column boundaries match every row's exactly, and
confirmed the tightest width (1024px) correctly falls back to a local,
synchronized horizontal scroll without ever producing page-level scroll.
Mobile (375px) card layout untouched and reconfirmed unaffected (it's a
different component, not this grid). Test price list deleted after
verification.

## Phase 4A.1 — Cart clarity/UX revision (2026-08-08)

Follow-up to the cart build below: the functionality was solid but the
presentation wasn't self-explanatory — no column headers, two unlabeled
prices next to each other, a line total that wasn't visually tied to its
quantity, no shipping line in the summary at all. User asked for a
clarity-focused redesign (explicitly: don't touch the working Medusa
integration), inspired by — but not copying — strong Greek ecommerce carts,
combined with general international best practice. Design proposed as text/
ASCII wireframes with exact Greek labels and reasoning, approved, then built.

**What changed**:

- **Desktop full cart page (`/kalathi`, ≥1024px) is now a true table** with
  visible headers — `ΠΡΟΪΟΝ | ΑΡΧΙΚΗ ΤΙΜΗ | ΤΙΜΗ | ΠΟΣΟΤΗΤΑ | ΣΥΝΟΛΟ`
  (`CartTableHeader.tsx`, `CartLineItemTableRow.tsx`). Both share one grid
  column definition (`cart-table-grid.ts`) instead of two independently
  hand-typed class strings, so the header and the rows can't silently drift
  out of alignment as either file changes later.
- **The drawer (always) and the full page below 1024px use a dedicated
  labeled-card layout**, not the desktop table compressed narrower — a
  fixed ~440px drawer panel can't fit five aligned columns without tiny
  text, and neither can a 375px phone. `CartLineItemRow.tsx` now shows
  explicit "Αρχική τιμή:" / "Τιμή:" / "Ποσότητα:" / "Σύνολο:" labels instead
  of two adjacent unlabeled numbers.
- **Discount display**: a compact `-X%` badge next to the current price
  (`discountPercent()` in `lib/format.ts`) rather than a second full text
  row per item; the cart-level `Έκπτωση` line already states the concrete
  euro saving once, for the whole cart, so it isn't repeated per line. No
  discount indicator at all renders for non-sale items — a muted "–" fills
  the table's original-price cell instead of leaving it blank, keeping
  every row the same height without implying a fake discount.
- **`CartTotals.tsx`** — extracted from duplicated inline JSX in both the
  drawer and the full page, and given the **`Μεταφορικά`** line the
  original build never had at all. Medusa doesn't calculate real shipping
  until a shipping method is chosen at checkout, so there's no real number
  to show pre-checkout — the honest fix is `Υπολογίζεται στο checkout` plus
  a one-line note under `Σύνολο` clarifying that total excludes shipping,
  not a fabricated `0,00€`.
- **Coupon success state** relabeled from an inline `CODE · −amount`
  fragment to explicit `Κωδικός: SUMMER10` / `Έκπτωση: −10,00€` lines, and
  the idle toggle/input copy now matches the requested wording exactly
  ("Κωδικός έκπτωσης" / "Κωδικός κουπονιού" / "Εφαρμογή").
- **Checkout CTA relabeled** `ΠΡΟΧΩΡΗΣΗ ΣΤΟ CHECKOUT`. Added a
  `Συνέχεια αγορών` secondary link next to it in both the drawer (closes
  the drawer, matching the original spec's intent) and the full page
  (links to `/`) — a real gap found during this pass: the non-empty cart
  previously had no continue-shopping affordance at all, only the empty
  state did.
- **`QuantityStepper`** unified to 44×44px targets at every width — it
  previously shrank to 32px on desktop, which the brief's "do not use tiny
  controls" instruction flagged as worth fixing everywhere, not just
  mobile.

**Real bug found during verification, not a hypothetical**: `getCart()` —
called from `RootLayout`, so it runs on *every* page — threw
`Cannot read properties of null (reading 'code')` and took the entire site
down. Root cause: a promotion that had been applied to a cart and was then
deleted server-side leaves a `null` entry in `cart.promotions` rather than
being omitted (confirmed live by deliberately deleting an active test
promotion while it was applied to a cart, then reloading). The mapper in
`lib/data/cart.ts` assumed every array entry was a real object. Fixed with a
null-filter before mapping; `MedusaCart.promotions`'s type in `lib/medusa.ts`
now reflects `(MedusaPromotion | null)[]` so this can't silently regress.
(A real store wouldn't hard-delete an active promotion — it would deactivate
or let it expire — but the crash and its site-wide blast radius were real
and worth fixing regardless of how the state was reached.)

**Verified**: `tsc`/`eslint`/`next build` all clean (backend live). Manual
in-browser testing used real data, not simulated states — a real Medusa
sale price list was created via the Admin API to produce an actual
discounted line item (`-29%` badge, struck-through original price, correct
subtotal math), and a real promotion code was applied and removed with
correctly recalculated totals. Also confirmed: non-discounted line shows no
badge and a "–" placeholder; quantity 1 vs. >1; remove → empty-state
transition; free-shipping bar in both the below-threshold ("Ακόμα 33,10€...")
and reached ("🎉") states; 375px mobile width with zero horizontal scroll;
desktop table header/row alignment. Long product names and multi-variant
rendering were verified by code inspection (no truncation classes present;
the variant line was already conditional from the original build) rather
than a live long-name product, since none exists in the current catalog —
noted rather than silently assumed. All test artifacts (the sale price list,
the promotion code, the cart contents used to test them) were deleted/reset
after verification; the `test-agent@stia.gr` admin user used to create them
remains (see the note in the Phase 4A entry below and `PROJECT_MEMORY.md`).

## Phase 4A — Cart experience, design + build (2026-08-08)

User asked for a full research-and-design pass on the cart before any code,
with an explicit, detailed brief (drawer behavior, mini-cart contents,
pricing display, coupons, free shipping, error states, accessibility,
Medusa architecture — reproduced in full in `NEXT_STEPS.md`'s history and
`CART_UX_SPEC.md`). Spec was written, presented, and approved; then the cart
was built and verified end-to-end against the real backend.

**Design phase**: grounded in a live check of `public.gr`'s cart-adjacent PDP
UI (bundle upsell widget with a combined total + single "add" button,
discount amount + struck-through original price, star-rating pattern) plus
well-established general cart/checkout usability research. Two other sites
(`zarahome.com`, `ikea.com`) were attempted for comparison and blocked by
this environment's browsing controls — no claims were made about them.
Full spec: `CART_UX_SPEC.md`.

**Live API verification** (before writing any adapter code, same discipline
that caught real bugs in Phase 3) surfaced several non-obvious, real Medusa
v2 behaviors:

- Line-item **update is `POST`**, not `PATCH`
  (`/store/carts/:id/line-items/:line_id`).
- Line-item **delete's response shape differs from every other cart
  endpoint** — the updated cart comes back under a `parent` key, not `cart`
  (`{ id, object, deleted, parent: {...} }`).
- Promotions: apply is `POST .../promotions`, remove is **`DELETE`
  `.../promotions` with a `{ promo_codes: [...] }` body** — an unusual but
  real, working pattern (verified by creating a real test promotion via the
  Admin API, applying it, and removing it, not just reading docs).
- Medusa **enforces inventory limits server-side** — attempting to exceed
  stock returns `{ code: "insufficient_inventory", type: "not_allowed" }`.
  But the message doesn't include the actual remaining count, and the Store
  API doesn't expose per-variant stock on the products endpoint at all in
  this setup (`+variants.inventory_quantity` is silently ignored, confirmed
  live) — so the cart's stock UI is honestly **reactive, not proactive**:
  it can't show "only 3 left" or pre-disable "+", only react to the real
  error after the fact. This is a deliberate adjustment from the approved
  spec's error table (which assumed an exact count would be available).
- Neither seeded shipping option has a conditional free-shipping rule (both
  flat-rate, confirmed live) — so the free-shipping progress bar's
  threshold (`lib/cart-config.ts`) is genuinely frontend-only config today,
  not a mirror of backend logic.
- Prices are decimal euros throughout (not minor units), consistent with
  the rest of the storefront's existing convention.

**What was built**:

- `lib/data/cart.ts` (`getCart()`, read-only, Server-Component-safe) and
  `lib/actions/cart.ts` (`"use server"` mutations: add/update/remove line
  item, apply/remove promotion) — all cart writes are Server Actions that
  call `revalidatePath("/", "layout")`, following the same pattern as
  `lib/actions/recently-viewed.ts` from the previous session. Cart identity
  is a `cart_id` cookie (30-day max-age), not `localStorage`.
- `CartUIProvider` — a small Context for **UI-only** state (drawer
  open/closed, the add-to-cart toast), explicitly not a client-side store of
  cart data, per the approved spec's "no Redux/Zustand/heavy Context" call.
- `CartDrawer` (desktop side panel, mobile full-screen — not a partial
  sheet) reusing `MobileMenu`'s already-verified focus-trap/Escape/focus-
  return pattern; `AddToCartToast` (bottom-anchored on mobile, header-
  anchored on desktop, never auto-opens the drawer); `CartLineItemRow`,
  `QuantityStepper`, `CouponForm`, `FreeShippingProgress`, `EmptyCartState`
  (reuses the just-shipped `RecentlyViewed` component) — all shared between
  the drawer and the full `/kalathi` page via `useCartController`
  (`lib/hooks/use-cart-controller.ts`), which optimistically patches a
  touched line's own quantity/total for instant feedback while leaving
  cart-level totals to reconcile from the real server response a moment
  later (tax/discount math isn't something this hook should reimplement).
- `/kalathi` full cart page — two-column desktop, single-column mobile,
  cross-sell rail (`getCartCrossSell` in `lib/data/products.ts`) using the
  same honest same-category signal as the PDP's related-products rail, not
  a fabricated "customers also bought" claim (no order history exists to
  back that — same reasoning already applied once this project).
- `AddToCartButton` and `ProductCard`'s quick-add are no longer inert — both
  call `addLineItemAction` for real. The checkout CTA links to `/checkout`,
  a route that doesn't exist yet, matching the same accepted pattern as the
  footer's not-yet-built content pages (an honest 404 today, not a fake
  success or a silent no-op).

**Verified** (real backend, both dev servers running): `tsc`/`eslint`/
`next build` all clean; manually confirmed add-to-cart toast + header badge
update, quantity merge on re-adding the same variant, optimistic-then-
reconciled quantity changes, remove → empty-state transition on both the
drawer and the full page, an invalid coupon code showing the mapped Greek
error, a real activated test promotion applying and removing correctly with
recalculated totals, the free-shipping bar reaching 100%, the drawer being
genuinely full-width on a 375px mobile viewport (not a partial sheet),
Escape closing the drawer with focus returning to the header cart button,
Tab-trap wrapping correctly inside the drawer, and cart contents surviving
a real full-page reload via the cookie. `next build`'s route table changed
from static (`○`) to dynamic (`ƒ`) for the homepage and other routes — an
expected consequence of `RootLayout` now reading the cart cookie via
`cookies()`, not a regression.

One test artifact intentionally left behind, documented rather than hidden:
a temporary admin user (`test-agent@stia.gr`) created to test the coupon
flow via the Admin API — Medusa disallows a user deleting itself, and the
real admin password wasn't available to remove it with. Harmless, local-dev
only. The test promotion code itself was deleted after verification.

## Phase 4 unblocked items: related products + recently viewed (2026-08-08)

Implemented the two Phase 4 items that weren't blocked on missing content
(real photography, multi-variant products), per user decision after being
asked which of three options to pursue next.

- **Related products** (`ProductRail` on the PDP, `getRelatedProducts` in
  `lib/data/products.ts`): same-category cross-sell, deliberately **not**
  labeled "frequently bought together" as originally scoped in `TASKS.md` —
  there's no order history yet, so a real co-purchase signal doesn't exist.
  Labeling it that way would fabricate a trust/relevance claim, the same
  category of bug as the fake 4.6-star ratings fixed during the Phase 3
  audit. Labeled "Σχετικά προϊόντα" (related products) instead — an honest
  description of what the data actually is. Revisit once real order data
  exists to compute genuine co-purchase pairs.
- **Recently viewed** (`RecentlyViewedTracker`, `RecentlyViewed` components):
  client-side only (`lib/recently-viewed-storage.ts`, `localStorage`, capped
  at 8, most-recent-first, fails silently if storage is unavailable). Product
  handles are only known in the browser, so resolving them to real product
  data needed a bridge back to the server — added a Server Action
  (`lib/actions/recently-viewed.ts`, `getProductsByHandles` in
  `lib/data/products.ts`) rather than a `route.ts` API handler, keeping the
  "storefront has no API routes of its own" property mentioned in
  `CURRENT_STATE.md` technically intact (Server Actions aren't a routed
  handler file).
- `ProductRail`'s `viewAllHref` prop made optional — both new sections use it
  without a "view all" link, unlike the homepage's existing usage.
- Verified: `tsc --noEmit`, `eslint`, `next build` all clean; manual
  in-browser check with the real backend running — visited two products,
  confirmed "Είδατε πρόσφατα" showed both in correct (most-recent-first)
  order on a third product's page, and "Σχετικά προϊόντα" showed a real
  same-category product. No console errors.

## Final handoff verification (2026-08-07)

Separate short session: re-read and verified all five memory files against
actual `git log`/`git status` (clean, nothing uncommitted, `origin/main` up to
date). No code or content changes were needed — the prior handoff below was
already accurate. Added an explicit "START HERE NEXT SESSION" section to the
top of `NEXT_STEPS.md` per an explicit formatting request, restating (not
changing) the same resume point already documented.

## Session handoff (2026-08-07)

No code changes — Phase 3 was already complete, committed, and pushed (see the
entry directly below). This entry just documents that the session ended with a
deliberate handoff: `CURRENT_STATE.md` and `NEXT_STEPS.md` were added,
`PROJECT_MEMORY.md` was substantially expanded (design system, coding
conventions, SEO strategy, environment setup, development rules — previously
thinner), and `TASKS.md` was restructured into Completed/In Progress/Next/Future.
Nothing was left mid-change; working tree was clean before and after.

## Audit + Phase 3 — real data wiring (2026-08-07)

**Full engineering audit of Phases 1–2** before starting Phase 3, per explicit
request. Real findings, not theatrical ones:

- `ProductCard` nested an interactive `<button>` inside a `<Link>` (`<a>`) —
  invalid HTML content model, broke expected focus/tab order. Restructured so
  the quick-add button is a sibling, not a descendant.
- `MobileMenu` had `aria-modal="true"` but no actual focus management — no
  initial focus on open, no Escape-to-close, no focus trap, no focus return on
  close. Added all four. (Also found and worked around a real limitation: the
  browser-automation tool's synthetic `computer.key` presses don't reliably
  reach this environment's page — confirmed via `document.dispatchEvent`
  succeeding where `computer.key` silently no-opped. Documented in
  PROJECT_MEMORY.md so it isn't re-debugged as a code bug next time.)
- JSON-LD `Organization.logo` pointed at `/logo.png`, which doesn't exist
  (`public/` is empty — no brand assets yet). Removed the field rather than
  ship a broken structured-data URL.
- `siteUrl` was hardcoded independently in `layout.tsx`, `robots.ts`, and
  `sitemap.ts`. Extracted to `lib/site-config.ts`.
- Backend `.env`/`.env.template`: `STORE_CORS`/`AUTH_CORS` allowed
  `localhost:8000` (Medusa's own starter-template default) instead of
  `localhost:3000`, where this storefront actually runs. Would have silently
  broken every Store API call from the browser with a CORS error. Fixed both
  files.
- `JWT_SECRET`/`COOKIE_SECRET` were still the scaffold's literal
  `"supersecret"` default. Rotated to real random values.
- Removed two unused example API route stubs (`/admin/custom`,
  `/store/custom`) left over from the Medusa scaffold, and a `pnpm.overrides`
  block in `apps/backend/package.json` that pnpm itself was already warning is
  ignored.
- `rating`/`reviewCount` were required fields defaulting to a fabricated 4.6
  rating / 128 reviews on every mock product. There is no review system —
  made both optional, `ProductCard`/PDP only render stars when a rating is
  real. Same reasoning applied to the homepage: relabeled "Τα πιο δημοφιλή"
  (implies real popularity ranking) to "Προτεινόμενα" (featured/curated) since
  there's no order history yet to back a bestseller claim.
- Removed dead `--space-*` CSS custom properties from `globals.css` (declared,
  never referenced anywhere — Tailwind's own spacing scale was already doing
  the job).

**Then Phase 3**: wired the storefront to real Medusa data end-to-end.

- `lib/medusa.ts` — typed Store API fetch client. `lib/data/categories.ts` and
  `lib/data/products.ts` adapt Medusa's response shapes into the storefront's
  existing domain types (`Product`, `Category`, `NavCategory`), so
  `ProductCard` and friends needed zero changes — exactly the point of having
  kept the mock layer shaped like Medusa's API since Phase 1.
- Header/Footer/MobileMenu/CategoryGrid/homepage switched from the static
  `mock-data.ts` import to server-fetched real data (`RootLayout` fetches
  categories once, passes down as props). `mock-data.ts` deleted once nothing
  referenced it.
- New real pages: `/[category]`, `/[category]/[subcategory]` (PLP — sort,
  pagination, breadcrumbs, `BreadcrumbList` JSON-LD), `/proionta/[handle]`
  (PDP — real price/description, `Product` JSON-LD). `sitemap.ts` now
  enumerates the real catalog.
- **Two real bugs found during Phase 3 verification, not just plumbing**:
  1. Medusa's Store API has no `currency_code` query param on
     `/store/products` — pricing requires `region_id`. Not documented
     anywhere obvious; found by testing the actual endpoint before building
     more code on the wrong assumption.
  2. The only sales region (created by Medusa's own default demo seed during
     Phase 2) didn't include Greece in its countries — `["de","dk","es","fr",
     "gb","it","se"]`, no `"gr"`. For a Greek storefront this would have
     broken checkout/tax entirely for real customers. Added Greece to the
     region and created a matching Greek tax region.
  3. Top-level category pages (e.g. `/kouzina`) showed "0 products" — products
     are tagged with one specific subcategory, and Medusa's `category_id[]`
     filter doesn't implicitly include descendants. `getCategoryIdsForHandle`
     now resolves the category's own ID plus its direct children before
     querying.
  4. PDP's "Add to cart" button had the same nested-interactivity-class bug as
     the earlier `ProductCard` fix — an inline `onClick` in an async Server
     Component. Extracted into `AddToCartButton`, a small Client Component.

## Phase 2 — Medusa backend on Supabase, real catalog

See `PROJECT_MEMORY.md` for the architecture. Summary: scaffolded Medusa v2 in
`apps/backend` (its own nested pnpm workspace, deliberately excluded from the
root workspace), connected it to a Supabase-hosted Postgres, replaced the
default demo catalog (T-shirts/sweatshirts) with the real IA — 28 categories,
16 products, seeded via the Admin API. GitHub connected via `gh auth login`;
pushed to `thmavrakis7777/eshop7777`.

## Phase 1 — Storefront foundation, design system, homepage

Next.js 16 + Tailwind v4 scaffold. Design tokens: Inter + Literata, both
verified via Google Fonts' metadata API to actually support Greek glyphs
(the original pick, Newsreader, turned out to have zero Greek coverage — caught
before shipping). Full IA wired into mega menu/footer/sitemap. Homepage
sections built against a Medusa-shaped mock data layer. SEO shell (metadata,
Organization JSON-LD, robots.ts, sitemap.ts).

Bugs found and fixed during that phase's own verification: two Server
Components passing event handlers (same class of bug that recurred in the
audit above — worth noting as a recurring pattern to watch for), a mega menu
that clipped off-screen for edge items, a real responsive dead zone
(768–1023px had neither the mobile hamburger nor the desktop nav), and a
mobile drawer trapped inside the header by a `backdrop-filter`-created CSS
containing block.
