# Current State

Snapshot as of 2026-08-11, end of a very long session (New Arrivals/
infinite-scroll/carousels → cart price alignment → full audit → Admin-first
platform Phase A, in that order). This documents **what exists right now**,
verified by inspection — not aspiration. Cross-check against `git log` /
the actual file tree if this ever feels stale; update it whenever a session
ends. **This file itself is known to lag reality across sessions** (see the
note below about the intervening-sessions gap) — `git log`, `CHANGELOG.md`,
and `NEXT_STEPS.md`'s "START HERE" summary are the more reliably current
sources; treat the detailed prose further down this file as directional,
not authoritative, for anything it doesn't explicitly call out as recent.

**Everything below the 2026-08-09 card/wishlist/PDP snapshot line was
written across several intervening sessions this file was never fully
updated for** — Premium Checkout Phases 1-5, a search-dropdown/product-
image/cart-polish session, and this session's New Arrivals/infinite-scroll/
carousels work. Treat the "What has been completed"/"What is working"
prose below as reliable for what it explicitly describes, but not as an
exhaustive list.

Git state: `origin/main` is up to date through the "Admin-first platform,
Phase A" commit — New Arrivals/infinite scroll/carousels, the cart
alignment fix, the full technical audit, and Phase A (Product SEO: a new
`seo` custom Medusa module + admin widget + storefront wiring, see
`CHANGELOG.md`'s newest entries) are all committed and pushed. **Phase B
onward of the Admin-first platform (Category SEO, Homepage SEO, and the
rest of the ~11-phase roadmap in `TASKS.md`) has not been started.**

## What has been completed

- **Phase 0**: research, information architecture, design system decisions.
- **Phase 1**: storefront foundation — Next.js 16 scaffold, design tokens, base
  layout (header/mega menu/footer/mobile drawer), homepage sections, SEO shell.
- **Phase 2**: Medusa v2 backend scaffolded, connected to Supabase Postgres,
  real catalog seeded (28 categories, 16 products), GitHub repo connected and
  pushed.
- **Phase 3**: full audit of Phases 1–2 (real bugs found and fixed — see
  `CHANGELOG.md`), then the storefront wired to real Medusa data end-to-end:
  Store API client, data adapters, real category/subcategory pages, real
  product detail page, real sitemap.
- **Phase 4 (unblocked items)**: PDP "related products" (same-category) and
  "recently viewed" (`localStorage` + Server Action) rails.
- **Phase 4A**: full cart experience — spec written and approved
  (`CART_UX_SPEC.md`), then built and verified against the real Medusa
  backend. See "What is working" and `PROJECT_MEMORY.md` → "Cart
  architecture" for the details.
- **Phase 4A.1**: cart clarity/UX revision — labeled desktop table +
  labeled mobile/drawer cards, discount `%` badges, a real `Μεταφορικά`
  line in the totals breakdown, relabeled coupon/checkout copy. Design
  proposed and approved before coding, same pattern as Phase 4A. Found and
  fixed a real crash bug along the way (see `CHANGELOG.md`).
- **Phase 4B**: checkout — spec written and approved (`CHECKOUT_UX_SPEC.md`)
  after live Medusa research surfaced three groundwork decisions (a real
  shipping-zone gap fixed, the cart's free-shipping promise softened, the
  one real payment method decided), then built end-to-end and verified with
  a real completed guest order through the actual UI. See "What is working"
  and `PROJECT_MEMORY.md` → "Checkout architecture" for the details.
- **Production readiness audit** (2026-08-08, after Phase 5): a gated,
  whole-codebase pass — code review, performance, SEO, Core Web Vitals,
  accessibility, Medusa architecture, cleanup, and the full test gate.
  Real bugs found and fixed (fabricated homepage customer reviews, a
  checkout keyboard-focus bug, four SEO defects, two broken homepage links,
  three places overclaiming payment methods, redundant Medusa requests, dead
  code) — full list in `CHANGELOG.md`. Nothing about the cart/checkout/
  Medusa data flow was restructured; the audit's changes are contained
  fixes, not a rewrite.

- **Phase 5**: permanent unique product code (Medusa's native `variant.sku`,
  no new field), search by code or name (Medusa's own `q` full-text search,
  no new search index), and add-to-cart from every product grid in the app
  with real stock-awareness and multi-variant gating — spec written and
  approved (`PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md`) before any code, built,
  and verified live including a real out-of-stock test via the admin. See
  "What is working" and `PROJECT_MEMORY.md` → "Product code /
  add-to-cart-everywhere / search architecture" for the details.

- **Product card redesign, wishlist, stock display, PDP content** (this
  snapshot): card hierarchy reordered (image → title → code → price →
  stock → Add to Cart) per an explicit recommendation the user approved
  over their own first draft; a `localStorage`-backed wishlist (no Medusa
  wishlist module exists, no customer auth system to hang a real one off)
  with a live header count and a real `/lista-epithymion` page; a shared
  `StockStatus` component now showing the positive "Σε απόθεμα" state too,
  not just the negative one; PDP gains dedicated `Περιγραφή` and
  `Χαρακτηριστικά` sections (the latter using Medusa's native but currently
  empty product-attribute fields). Spec written and approved
  (`PRODUCT_CARD_WISHLIST_PDP_SPEC.md`) before any code. See "What is
  working" and `PROJECT_MEMORY.md` → "Product card / wishlist / stock
  display / PDP content architecture" for the details.

- **Premium Greek Checkout Phases 1-5, a search-dropdown/product-image/
  cart-polish session, and now Dynamic New Arrivals / infinite scroll /
  homepage carousels** (all committed through `24c00e3` except this
  session's newest work) — see `CHANGELOG.md` for the checkout phases and
  polish session, and below for this session's three features in detail.

- **Dynamic New Arrivals, infinite scroll, homepage carousels** (this
  snapshot): New Arrivals membership is now a hybrid rule (30-day
  `created_at` window OR Medusa's native `"new"` product tag, admin-
  manageable with zero backend changes) backing a real `/nea-afiksi` page;
  category/subcategory/search/New-Arrivals listings now auto-load
  additional batches via `IntersectionObserver` as the user scrolls, with
  the classic Prev/Next pagination kept as a real `<noscript>` crawlable
  fallback; both homepage rails (`Προτεινόμενα`/`Νέες αφίξεις`) are now
  touch-friendly horizontal carousels (native CSS scroll-snap, no library)
  with keyboard-operable desktop arrows, bumped from 4 to 12 products each,
  ending in a real "Δείτε Περισσότερα" tile linking to a full listing page
  — New Arrivals' at `/nea-afiksi`, and a new `/protainomena` ("Recommended
  Products") page for the featured rail. Explicit architecture review
  (findings + a recommended design for the few genuinely open decisions)
  was presented and approved before any code. See `CHANGELOG.md` and
  `PROJECT_MEMORY.md`'s new architecture section for full detail, including
  two real bugs found and fixed live during the infinite-scroll build.

[thmavrakis7777/eshop7777](https://github.com/thmavrakis7777/eshop7777) —
`origin/main` is up to date through `24c00e3` (see git state note above).
This session's New Arrivals/infinite-scroll/carousels work is **not yet
committed**.

## What is working (verified in-browser this session)

- Homepage: hero, category grid, featured-products rail, editorial banner,
  new-arrivals rail, trust strip, newsletter form (UI only, no backend —
  submitting it currently does nothing at all, see "Known gaps") — all
  rendering real Medusa data. **The "Τι λένε οι πελάτες μας" reviews section
  no longer exists**: it held three invented, named customer testimonials
  with hardcoded star ratings and was deleted during the production
  readiness audit as a fabricated trust signal (see `CHANGELOG.md`). **Both
  product rails are now real touch-friendly carousels** (2026-08-11: native
  CSS scroll-snap, keyboard-operable desktop arrows, 12 products each,
  ending in a real "Δείτε Περισσότερα" tile) and both now carry a real,
  working "Δες όλα →" link — `Προτεινόμενα` → `/protainomena`, `Νέες
  αφίξεις` → `/nea-afiksi` — replacing the previously-disabled links that
  used to point at dead routes.
- Header: sticky, mega menu (desktop, real subcategories + featured tile per
  category), mobile hamburger → drawer (real categories, working focus trap,
  Escape-to-close, focus return), search icon toggles a **real, working**
  search box (Phase 5 — no longer an inert input): debounced live-results
  dropdown as you type (matches by product name *or* code, backed by
  Medusa's own full-text search), Enter/submit or "Δες όλα" goes to a full
  `/anazitisi` results page.
- Footer: real category links, static help/company/legal links (those target
  pages don't exist yet — see "Known gaps" below).
- Category pages `/[category]` — e.g. `/kouzina`: real products (including
  from all subcategories, not just products tagged directly on the parent),
  subcategory chips, sort control (newest/title/price), pagination, breadcrumb
  with `BreadcrumbList` JSON-LD.
- Subcategory pages `/[category]/[subcategory]` — e.g. `/kouzina/tigania`:
  same as above, scoped to one subcategory.
- Product detail page `/proionta/[handle]`: real title/price/description,
  breadcrumb, `Product` JSON-LD (availability reflects real stock; gains
  `material`/`weight` when populated), a **real, working** "Add to cart"
  button (Phase 4A — no longer inert; Phase 5 adds real stock-awareness —
  disabled + "Εξαντλήθηκε" at zero stock — and a plain radio-group variant
  picker for any product with >1 variant, untested against real data since
  the catalog is still 100% single-variant). A wishlist heart sits on the
  main image (top-right); a `StockStatus` line ("Σε απόθεμα"/
  "Εξαντλήθηκε") sits directly above the Add to Cart button. A quiet
  "Κωδικός προϊόντος" row (Phase 5 — Medusa's native variant SKU) sits in
  the existing delivery/returns/payment metadata block. Below that: a
  dedicated `Περιγραφή` (Description) section and a `Χαρακτηριστικά`
  (Characteristics) section — the latter renders only populated
  material/weight/dimensions/origin-country fields and disappears entirely
  when a product has none (true for all 16 real products today — the
  architecture is real Medusa data, the content isn't entered yet). A
  "Σχετικά προϊόντα" (related products) rail — same-category cross-sell,
  server-fetched — and a "Είδατε πρόσφατα" (recently viewed) rail —
  client-side, `localStorage`-backed, resolved to real product data via a
  Server Action. See `CHANGELOG.md` for why "related" rather than
  "frequently bought together."
- **Wishlist** (new): a heart icon on every product image (`ProductCard`
  grid tiles and the PDP) toggles instantly — filled/accent when saved,
  updates the header's live count badge immediately, no toast/drawer
  interruption. `localStorage`-backed (`lib/wishlist-storage.ts`, a real
  external store read via `useSyncExternalStore`), same architecture as
  "recently viewed" since no Medusa wishlist module or customer auth system
  exists. A real `/lista-epithymion` page (previously a 404 placeholder
  since Phase 1) lists saved products with the same `ProductCard` grid, and
  a proper empty state when nothing's saved. Header's wishlist icon is
  still `hidden sm:block` (same as the account icon) — no header entry
  point on true mobile widths, a known pre-existing gap, not new.
- **Cart** (Phase 4A, refined in 4A.1): header cart icon shows the real item
  count and opens a drawer (desktop side panel / mobile full-screen) with
  real line items, working quantity steppers, remove, a coupon form
  (verified with both an invalid and a real activated promotion code), a
  free-shipping progress bar, and a full Υποσύνολο/Έκπτωση/Μεταφορικά/Σύνολο
  breakdown (`CartTotals`). Full cart page at `/kalathi` renders a true
  labeled table (`ΠΡΟΪΟΝ`/`ΑΡΧΙΚΗ ΤΙΜΗ`/`ΤΙΜΗ`/`ΠΟΣΟΤΗΤΑ`/`ΣΥΝΟΛΟ`) at
  desktop widths and a labeled card layout on mobile/in the drawer — not
  the same layout squeezed to fit. Discounted lines show a `-X%` badge;
  non-discounted lines show a neutral "–" in the original-price slot rather
  than nothing. Cart persists across a real page reload (cookie-backed).
- **Checkout** (Phase 4B, new): a real, working single-page guest checkout
  at `/checkout` — cart → checkout CTA reads `ΟΛΟΚΛΗΡΩΣΗ ΑΓΟΡΑΣ`. Email,
  contact details, and Greek address form (Οδός/Αριθμός/ΤΚ/Πόλη/Περιοχή,
  Χώρα locked to Ελλάδα) auto-save to the same Medusa cart as you type;
  real shipping options (Standard/Express, real prices, real Greek delivery
  estimates) resolve live once the address is complete; payment shows the
  one real configured method as "Αντικαταβολή." Final submit
  (`ΟΛΟΚΛΗΡΩΣΗ ΠΑΡΑΓΓΕΛΙΑΣ · {total}€`) creates a real Medusa order via a
  real payment collection/session, then redirects to a confirmation page at
  `/checkout/epibebaiosi?order={id}` — its own URL, survives a refresh,
  shows the order number, itemized totals, delivery address, and a
  non-blocking "create an account?" link. Mobile: order summary collapsed
  at the top (total always visible), submit CTA a real fixed bottom bar.
- **Add to cart from every product grid** (Phase 5, redesigned this
  session): `ProductCard` — the one shared card component rendering on
  home, category/subcategory PLPs, PDP related/recently-viewed, cart
  cross-sell, and search results — now gates its quick-add on real stock
  (`StockStatus` line + disabled button) and real variant count (a product
  with >1 variant shows an "Επιλογές" link to the PDP instead of guessing a
  variant). Card layout as of this session: image (wishlist heart
  top-right) → title → code → price → stock → Add to Cart, a real row in
  normal flow — no longer an absolutely-positioned hover-reveal overlay, so
  the Phase 4A/5 desktop-hover/mobile-always-visible CSS split no longer
  exists (nothing left to regress there).
- **Search** (Phase 5): `/anazitisi` results page — real product grid (same
  `CategoryPLPView`/`ProductCard` as category pages, so add-to-cart works
  from search results too), sort control, pagination, matches by product
  name or code.
- `robots.txt` and `sitemap.xml`: dynamic, enumerate the real catalog.
- Medusa admin dashboard (`localhost:9000/app`): login works, products/
  categories visible and match the storefront.

## What has been tested

- `tsc --noEmit`, `eslint`, and `next build` all clean (zero errors) for
  `apps/storefront` as of the last commit.
- `medusa lint` clean for `apps/backend/apps/backend`.
- Manual in-browser verification (this session): homepage, `/kouzina` (top-level
  category — this is what caught the "0 products" bug), `/kouzina/tigania`
  (subcategory), `/proionta/antikollitiko-tigani-28` (product), mega menu open
  via real hover, mobile menu open/close/focus behavior at 390px width.
- Responsive verification at 375/768/815/1280px was done in **Phase 1** (before
  real data existed) — the layout hasn't changed structurally since, but it has
  **not** been re-verified at all breakpoints with real data/real product counts
  since Phase 3. Low risk (data volume didn't change UI structure) but not
  re-confirmed.
- Direct `curl` verification of the Medusa Store API query shapes used by
  `lib/data/*.ts` (category filtering, region-based pricing) against the live
  backend before trusting them in application code.
- (2026-08-08) Related products + recently viewed: `tsc`/`eslint`/`next build`
  clean with the real backend running; manually verified in-browser — visited
  two products, confirmed "Είδατε πρόσφατα" showed both in the correct
  most-recent-first order on a third product's page, "Σχετικά προϊόντα"
  showed a real same-category product, no console errors.
- (2026-08-08) Cart (Phase 4A): `tsc`/`eslint`/`next build` all clean with the
  real backend running. Manually verified: add-to-cart toast + header badge
  update; adding the same variant twice merges quantity instead of
  duplicating the row; quantity stepper shows an instant optimistic update
  that reconciles to the real server total a moment later; removing the only
  item transitions both the drawer and the full `/kalathi` page to the empty
  state without a reload; an invalid coupon code shows the mapped Greek
  error inline; a real activated test promotion applies and removes with
  correctly recalculated subtotal/discount/total; the free-shipping bar
  reaches the "🎉" state above the threshold; the drawer is genuinely
  full-viewport-width on a 375px mobile size (not a partial sheet); Escape
  closes the drawer and returns focus to the header cart button; Tab wraps
  correctly at the drawer's focus boundaries; cart contents survive a real
  full-page reload via the `cart_id` cookie.
- (2026-08-08) Cart clarity revision (Phase 4A.1): `tsc`/`eslint`/
  `next build` all clean with the real backend running. Manually verified
  with **real discount data**, not a simulated state — created a real
  Medusa sale price list via the Admin API to produce an actual `-29%`
  line, confirmed the desktop table's headers align with values, the
  mobile/drawer card shows the right labels for both a discounted and a
  non-discounted line in the same cart, the free-shipping bar in both the
  below-threshold and reached states, a real coupon applying/removing with
  correctly recalculated `Υποσύνολο`/`Έκπτωση`/`Σύνολο`, remove → empty
  state on both the drawer and the full page, and 375px mobile width with
  zero horizontal scroll. Also **found and fixed a real crash**: deleting
  an actively-applied test promotion left a `null` in `cart.promotions`
  that crashed `getCart()` (and therefore every page, since `RootLayout`
  calls it) — see `CHANGELOG.md`. All test artifacts (sale price list,
  promotion code, cart contents) were cleaned up after verification.
- (2026-08-09) Product card redesign, wishlist, stock display, PDP content:
  `tsc`/`eslint`/`next build` all clean with the real backend running.
  Manually verified: card hierarchy matches the approved order on a real
  product; wishlist toggle updates the header count instantly with no
  toast/drawer, persists in `localStorage`, `/lista-epithymion` resolves
  and displays it via the Server Action, and removing the last item shows
  the empty state immediately (checked via `handles.length`, not stale
  `products` state); out-of-stock state (driven via a direct Admin API
  call — the temporary admin dashboard's row-action menu proved unreliable
  to drive through browser automation this session) confirmed correct and
  then restored on both the PDP and a grid card, including the
  disabled-button check; single h1/logical h2 heading hierarchy on the PDP
  confirmed via `document.querySelectorAll`; `Product` JSON-LD confirmed to
  correctly omit `material`/`weight` entirely for a product with no
  characteristics data; 375/768/1280px all `scrollWidth === innerWidth`
  (zero horizontal overflow); a real long product name wraps cleanly
  without breaking grid alignment; `/kalathi`'s cross-sell rail (also
  `ProductCard`) renders with zero console errors. **A real bug was found
  and fixed during this verification**: `useSyncExternalStore`'s
  `getServerSnapshot` returned a fresh `[]` literal each call, which React
  flagged live ("should be cached to avoid an infinite loop") — fixed with
  a stable module-level constant. **Not re-verified**: a discounted
  product's card/PDP rendering (no active promotion exists in the live
  catalog to test against; the discount/`compareAtPrice` code path itself
  wasn't touched this session).
- (2026-08-08) Product code, add-to-cart everywhere, search (Phase 5):
  `tsc`/`eslint`/`next build` all clean with the real backend running.
  Manually verified: searched the header dropdown by exact SKU, partial SKU
  substring, and a Greek product name — all returned the correct product(s);
  visited `/anazitisi` directly and via "Δες όλα"; confirmed "Κωδικός
  προϊόντος" displays correctly on the PDP; used a temporary admin user
  (`qa-agent@stia.gr`) to zero a real product's stock (`European Warehouse`
  location) and confirmed `Εξαντλήθηκε` appeared, disabled, on both the PDP
  button and the grid card's badge/button, then restored the stock;
  confirmed quick-add from a grid card at a real 375px mobile viewport
  actually adds the item (cart badge incremented) without opening the
  drawer; confirmed the same quick-add button is hover-revealed (not
  permanently visible) at a real 1280px desktop width via
  `getComputedStyle()`. **Not re-verified this session**: a discounted
  product's behavior end-to-end (no active promotion exists in the live
  catalog right now, and the discount/`compareAtPrice` code path itself
  wasn't touched by this phase); a coupon surviving a quick-add specifically
  (only ever verified via the PDP's main add-to-cart button in earlier
  phases); the multi-variant radio picker and grid-card "Επιλογές" routing
  (no real multi-variant product exists in the catalog to click through).
- (2026-08-08) Checkout (Phase 4B): `tsc`/`eslint`/`next build` all clean
  with the real backend running. Manually verified **with a real completed
  order through the actual UI**: added a product, filled the form,
  triggered and then corrected invalid-email/invalid-phone/invalid-postal-
  code inline errors (confirmed only touched fields show errors), watched
  real shipping options resolve live with real prices and Greek delivery
  estimates, selected one and watched the order summary update in place,
  submitted, landed on the confirmation page with a real order number,
  confirmed the cart cleared afterward (cookie deleted, header badge back
  to 0), confirmed the confirmation page survives a hard refresh, confirmed
  an empty cart at `/checkout` redirects to `/kalathi`, confirmed
  375/768/1280px widths all have zero horizontal scroll and the mobile
  order summary/submit bar are positioned correctly (verified via real
  `getBoundingClientRect` measurements, not text-order tools — see
  `PROJECT_MEMORY.md` for why that distinction mattered here). Two real
  test orders now exist in the local dev database (harmless, local only).

## What has NOT been tested

- **New Arrivals' tag-override branch** (2026-08-11) — a product outside
  the 30-day window but carrying Medusa's native `"new"` tag re-entering
  New Arrivals. No such product exists in the current 16-product catalog
  (all created within the last 30 days), so this specific branch of
  `isNewArrivalMember()` is verified by code inspection/type-checking only,
  not live. Re-verify once the catalog has a genuinely old product to tag.
- **Discounted products through the checkout flow specifically** —
  discount math (Έκπτωση) was verified in the cart and in the direct API
  dry-run before any UI was built, but not re-confirmed end-to-end through
  the checkout UI with a real discounted product in the order summary.
- **The redesigned card/PDP with a real discounted product** — same root
  cause as above (no active promotion exists in the live catalog right
  now); the compareAtPrice/badge rendering code itself wasn't touched by
  the card redesign, so risk is low, but it wasn't re-clicked-through.
- **Wishlist across multiple browser tabs** — the external store
  (`lib/wishlist-storage.ts`) doesn't listen for the `storage` event, so a
  toggle in one tab won't live-update another already-open tab on the same
  origin (it will pick up the change on next navigation/reload in that
  tab). Not requested, not built — noting as a known limitation, not a bug.
- **Wishlisting a multi-variant product** — no real multi-variant product
  exists in the catalog to click through, same limitation as the variant
  picker itself.
- **Coupon codes carrying from cart into checkout** — architecturally
  automatic (checkout operates on the same Medusa cart, nothing is
  re-entered), and coupons were verified working in the cart itself, but
  not re-confirmed by applying one in the cart and then completing a
  checkout with it still applied.
- **A second/real payment provider** — today there's exactly one
  (`pp_system_default`, shown as "Αντικαταβολή"); the multi-provider radio
  selection UI is unexercised since there's never been more than one to
  choose between.
- **Payment failure** — the system-default provider always succeeds
  (confirmed live); there's no way to force a real payment failure without
  a second, failure-capable provider, so `completeCheckoutAction`'s failure
  branch is coded per Medusa's documented contract but not force-triggered.
- **Stock disappearing mid-checkout** — Phase 5 confirmed real per-variant
  stock *is* readable via the Store API (`+variants.inventory_quantity`,
  see `PROJECT_MEMORY.md` for the corrected note), so this is no longer
  blocked the way it used to be — just not yet exercised: no test has
  actually zeroed a product's stock *while* a checkout was already in
  progress with it in the cart.
- **The "insufficient stock" cart error path in-browser** — verified
  directly against the live API (confirmed Medusa returns
  `insufficient_inventory` and the action maps it to the right Greek copy).
  Phase 5's out-of-stock testing (zeroing a product via the admin, see "What
  has been tested" above) confirmed the *pre-emptive* UI (disabled button,
  `Εξαντλήθηκε`) works, which covers most of what this gap was about — but
  still not re-confirmed by clicking "+" enough times on an *in-stock* item
  to hit its real ceiling from the cart's quantity stepper specifically.
- **Cart under multiple concurrent tabs/sessions** — not tested; the cookie-
  based single-guest-cart model is standard Medusa practice but hasn't been
  stress-tested here.
- **Search relevance/typo-tolerance** — Phase 5 built real search (name and
  product code both work, see "What is working" above), but it's Medusa's
  own `q` param, which is Postgres `ILIKE`-style matching, not a real search
  engine — no fuzzy/typo-tolerant matching, no relevance ranking beyond
  Medusa's default. Acceptable scoping choice at today's 16-product catalog;
  revisit only if the catalog grows substantially.
- **Account / wishlist pages** — `/logariasmos`, `/lista-epithymion` are linked
  from the header but don't exist as routes yet (404).
- **Footer content pages** — `/sxetika`, `/oroi-xrisis`, `/aporrito`, `/cookies`,
  `/paraggelia`, `/apostoles`, `/epistrofes`, `/faq`, `/epikoinonia`,
  `/odigoi-agoron`, `/dora-gamou`, `/karieres` — all linked, none exist (404).
- **Production build/deploy** — only ever run `next build` locally; never
  deployed to Vercel or anywhere else. No production environment variables
  configured anywhere outside this local machine.
- **Lighthouse / Core Web Vitals / accessibility audit tooling** — the
  production readiness audit was a manual review plus live DOM/computed-style
  measurement (focus behaviour measured via `document.activeElement`, colour
  contrast computed by hand against WCAG AA, rendered `<head>` read off the
  wire). **axe and Lighthouse still have never been run**, and no runtime
  performance profiling (real LCP/INP/CLS numbers) has been captured — the
  CWV work so far is structural (no layout-shifting images since there are
  none, request waterfalls flattened, client-side nav restored on category
  chips), not measured.
- **Cross-browser** — only verified in the one automation-controlled browser
  pane available in this environment. Not tested in real Chrome/Safari/Firefox,
  not tested on a real mobile device.
- **Multi-variant products** — the catalog is 100% single-variant products
  today. Phase 5 built the forward-design UI for this (a plain radio-group
  picker in `AddToCartButton`, an "Επιλογές" link on grid cards instead of a
  blind quick-add), but with no real multi-variant product to click through,
  none of it has been exercised against real data — verified by code
  inspection and the `tsc`/`eslint`/`next build` gate only.
- **What happens if the Medusa backend is unreachable** — the storefront has no
  fallback/error UI for a failed Store API call; an outage would currently
  surface as Next.js's generic error page, not a graceful degraded state.
- **The newsletter form does nothing.** It validates as an `<input
  type="email" required>` and then `preventDefault()`s with no feedback, no
  request, and no stored address — a customer who signs up gets silence.
  Flagged in the production readiness audit and deliberately left alone (it
  needs a real email provider decision, not invented plumbing).
- **`PaymentSection`'s multi-provider UI is structurally broken**, not just
  unexercised: it renders one always-`checked` `readOnly` radio per provider
  with no selection state, and `completeCheckoutAction` uses `providers[0]`
  regardless of what's shown. Harmless today (exactly one provider exists);
  must be built for real alongside the first real payment processor.
- **The favicon is still Next.js's own default logo** — `public/` is empty
  and no brand asset exists, so the framework's built-in icon is being
  served. Needs a real brand mark, same blocker as the missing
  `Organization.logo` in JSON-LD.
- **No Content-Security-Policy.** Baseline security headers were added in the
  production readiness audit (`nosniff`, `X-Frame-Options`,
  `Referrer-Policy`, `poweredByHeader: false`), but a real CSP needs
  per-request nonces threaded through the inline JSON-LD `<script>` tags on
  nearly every page — deliberately deferred as its own change.

## Current file structure (storefront, `apps/storefront/src`)

```
app/
  layout.tsx                    RootLayout — fetches nav categories + cart, renders
                                 Header/Footer wrapped in CartUIProvider, mounts
                                 CartDrawer/AddToCartToast
  page.tsx                      Homepage
  globals.css                   Tailwind v4 theme tokens
  robots.ts
  sitemap.ts                    Dynamic, pulls real catalog
  [category]/page.tsx           Top-level category PLP
  [category]/[subcategory]/page.tsx   Subcategory PLP
  proionta/[handle]/page.tsx    Product detail page
  kalathi/page.tsx              Full cart page
  checkout/page.tsx             Checkout — redirects to /kalathi if cart is empty
  checkout/epibebaiosi/page.tsx Order confirmation — reads ?order= search param
  anazitisi/page.tsx            Search results — searchProducts(q), reuses CategoryPLPView
  lista-epithymion/page.tsx     Wishlist page — noindex, renders WishlistPageView
  nea-afiksi/page.tsx           New Arrivals — getNewArrivalsPaged(), reuses CategoryPLPView
  protainomena/page.tsx         Recommended Products — getFeaturedProductsPaged(), reuses CategoryPLPView

components/
  layout/     AnnouncementBar, Header, Footer, MobileMenu, SearchBox
              (debounced live-results dropdown, backed by
              lib/actions/search.ts — Header renders it inside its existing
              search-toggle panel)
  home/       Hero, CategoryGrid, ProductRail, EditorialBanner, TrustStrip, Newsletter
              (Reviews.tsx deleted — fabricated testimonials, see CHANGELOG)
  category/   Breadcrumbs, CategoryPLPView (also powers /anazitisi,
              /nea-afiksi, /protainomena — takes optional extraParams/
              emptyMessage so a non-category listing doesn't need its own
              copy of the grid+pagination+sort chrome; basePath must be a
              pure path with no query string of its own; now also takes a
              `source: ProductSource` telling InfiniteProductGrid which
              Server Action to call for the next batch), Pagination (now
              only ever rendered inside a <noscript> fallback, see
              InfiniteProductGrid), SortControl,
              InfiniteProductGrid (2026-08-11, Client Component —
              IntersectionObserver-driven "load more," dedupes by product
              id, resets on sort/source change via a resetKey, re-creates
              the observer per batch — see PROJECT_MEMORY.md for why)
  product/    ProductCard (single shared card on every product grid in the
              app — real stock + multi-variant gating lives here, Phase 5;
              hierarchy redesigned this session: image → title → code →
              price → stock → Add to Cart, a real row, no longer an
              absolute-positioned overlay), AddToCartButton (PDP — takes
              `product`, not `variantId`, since Phase 5; manages its own
              variant-selection state), StockStatus ("Σε απόθεμα"/
              "Εξαντλήθηκε", shared by ProductCard + PDP),
              ProductCharacteristics (PDP-only, renders nothing if no real
              spec data exists), RecentlyViewedTracker, RecentlyViewed
  wishlist/   WishlistProvider (React context over the useSyncExternalStore-
              backed lib/wishlist-storage.ts), WishlistButton (heart toggle,
              used on ProductCard + PDP), WishlistPageView (client, resolves
              handles via the Server Action, real empty state)
  cart/       CartUIProvider, CartDrawer, CartPageView, AddToCartToast,
              CartLineItemRow (labeled card — drawer + mobile),
              CartLineItemTableRow (5-column table row — desktop full page),
              CartTableHeader (pairs with CartLineItemTableRow),
              cart-table-grid.ts (shared column-width constant),
              QuantityStepper, CouponForm, FreeShippingProgress (disabled,
              see below), CartTotals (Υποσύνολο/Έκπτωση/Μεταφορικά/Σύνολο —
              shared with checkout's order summary), EmptyCartState
  checkout/   CheckoutForm (orchestrator — all form state, auto-save, submit),
              SectionHeading, FormField, EmailSection, ContactSection,
              AddressSection, checkout-form-state.ts (shared field types),
              ShippingSection, PaymentSection, CheckoutOrderSummary
  ui/         PlaceholderTile, Stars, Icons

lib/
  types.ts           Domain types (Product, Category, NavCategory, Money, Cart,
                      CartLineItem, AppliedPromotion, Address, AddressSummary,
                      ShippingOption, PaymentProvider, Order, OrderLineItem).
                      Product/ProductVariant gained `code` (Medusa's variant
                      SKU) and `isAvailable` (real stock, Phase 5). Product
                      gained `characteristics: ProductCharacteristics | null`
                      (material/weight/dimensions/origin, null-safe).
  medusa.ts           Store API fetch client + raw Medusa response types +
                       MedusaApiError (typed error class), MedusaCartCompleteResponse
                       (discriminated union for /carts/:id/complete).
                       MedusaVariant gained inventory_quantity/
                       manage_inventory/allow_backorder (Phase 5 — these
                       require explicit `+variants.*` fields, not returned by
                       default). MedusaProduct gained material/weight/length/
                       width/height/origin_country (native Medusa attribute
                       fields, all currently null on real products), and
                       tags: {id, value}[] (2026-08-11 — native Medusa
                       product tags, confirmed live via +tags.value, backs
                       New Arrivals' admin-tag override).
  format.ts           Price formatting (el-GR locale) + discountPercent() +
                      formatWeight()/formatDimensions() (grams→κιλά above
                      1kg, cm dimensions — Medusa's documented unit defaults)
  checkout-validation.ts   isValidEmail/isValidPhone/isValidPostalCode/isRequired
  site-config.ts       siteUrl / siteName (single source)
  search-params.ts     Safe sort/page query-param parsing + canonicalListingPath()
                        (page-aware canonical URLs for paginated listings)
  recently-viewed-storage.ts   localStorage read/write for recently-viewed handles
  wishlist-storage.ts   Real external store (module-level cache + listener set,
                        read via useSyncExternalStore) for the wishlist —
                        getSnapshot/getServerSnapshot must return stable
                        array references or React throws an infinite-loop
                        warning, see PROJECT_MEMORY.md for the real bug this
                        caused and how it was fixed
  cart-config.ts       FREE_SHIPPING_THRESHOLD_EUR (configurable, not hardcoded —
                       currently unused, see FreeShippingProgress note above)
  hooks/
    use-cart-controller.ts   Shared quantity/remove/coupon logic + optimistic
                              per-row updates, used by both CartDrawer and
                              CartPageView
  data/
    categories.ts       Medusa → domain adapters for categories/nav
    products.ts          Medusa → domain adapters for products, sorting, pagination,
                          getProductsByHandles, getRelatedProducts, getCartCrossSell,
                          searchProducts (Phase 5 — Medusa's own `q` full-text
                          search, indexes title + variant SKU together),
                          isVariantAvailable (Phase 5 — the real-stock rule),
                          toDomainCharacteristics (null-safe, only-populated-
                          fields mapping for the PDP Characteristics section),
                          isNewArrivalMember (2026-08-11 — 30-day window OR
                          "new" tag), getNewArrivalsPaged/getFeaturedProductsPaged
                          (2026-08-11 — paginated, membership-filtered/sorted,
                          back both the homepage rails and their full pages)
    cart.ts               getCart() — read-only, cookie-based, Server-Component-safe;
                          toDomainCart()/toAddressSummary() also used by lib/data/checkout.ts
    checkout.ts            getShippingOptionsForCart, getPaymentProviders, getOrder
  actions/
    products.ts           (2026-08-11) loadMoreCategoryProductsAction/
                          loadMoreNewArrivalsAction/loadMoreFeaturedProductsAction/
                          loadMoreSearchProductsAction — thin per-listing-type
                          wrappers called directly from InfiniteProductGrid
    recently-viewed.ts   Server Action bridging client-known handles → real product data
    wishlist.ts            Server Action bridging wishlist handles → real product data
                          (same shape as recently-viewed.ts), backs WishlistPageView
    search.ts             Server Action (Phase 5) — small-limit preview wrapper
                          around searchProducts, backs SearchBox's live dropdown
    cart.ts               Server Actions: addLineItemAction, updateLineItemQuantityAction,
                          removeLineItemAction, applyPromoCodeAction, removePromoCodeAction,
                          getCartAction — all revalidatePath("/", "layout") on success
    checkout.ts            Server Actions: updateCheckoutEmailAction,
                          updateCheckoutDetailsAction, setShippingMethodAction,
                          completeCheckoutAction (payment collection → payment
                          session → cart complete, clears the cart cookie on success)
```

Note: `ProductRail` (`components/home/ProductRail.tsx`) is imported by
homepage sections, the PDP's related/recently-viewed rails, and the cart's
empty-state/cross-sell rails — it lives under `home/` for historical reasons
(built there first) but is a generic, domain-agnostic component; don't read
the folder name as scoping its use to the homepage.

`lib/mock-data.ts` **no longer exists** — deleted once nothing referenced it (all
consumers switched to `lib/data/*.ts`). If you see any lingering reference to it,
that's stale and needs fixing.

## Current database state (Supabase Postgres, via Medusa)

- **28 product categories**: 6 top-level (Κουζίνα, Αποθήκευση & Οργάνωση, Μπάνιο,
  Καθαρισμός, Κήπος, Είδη Σπιτιού) + 22 subcategories.
- **16 products**, all single-variant, all currently tagged `"new"` (created
  recently enough to fall inside the 30-day new-arrival window in
  `lib/data/products.ts` — this will naturally stop being true over time, that's
  expected/correct behavior, not a bug).
- **1 region** ("Europe", EUR) — includes Greece (fixed this session; see
  `PROJECT_MEMORY.md` "Important technical decisions").
- **1 tax region** for Greece (`country_code: "gr"`, `provider_id: "tp_system"`).
- **1 sales channel** ("Default Sales Channel"), **1 publishable API key**
  (in `apps/storefront/.env.local`, gitignored), **1 stock location**
  ("European Warehouse"), default shipping profile/options from Medusa's
  built-in demo seed.
- **Several admin users**: `admin@stia.gr` (real, password not recorded in
  the repo) plus a run of temporary `qa-agent`-pattern accounts created
  one per session as needed to drive the Admin API directly (`test-agent@
  stia.gr`, `qa-agent@stia.gr`, `qa-agent2@stia.gr` through `qa-agent5@
  stia.gr` as of Admin-first platform Phase K — see `PROJECT_MEMORY.md`
  for which phase created each one). All temporary accounts are safe to
  delete whenever convenient; see `TASKS.md`.
- **0 active promotions** — a test promotion was created and activated to
  verify the coupon flow, then deleted after verification. No real coupon
  campaigns exist.
- Guest carts created during Phase 4A/4B verification exist in the database
  as ordinary abandoned carts — expected, harmless, same as any real
  visitor who didn't check out.
- **2 real orders** (`display_id` 1 and 2), created during Phase 4B checkout
  verification — a completed order was the only way to actually confirm
  the full flow works end-to-end, not just each API step in isolation.
  Harmless, local dev only.
- **1 payment provider**: `pp_system_default` (Medusa's built-in manual
  provider) — no real card/wallet processor configured. Presented to
  customers as "Αντικαταβολή."
- Shipping fulfillment service zone now includes Greece (`gr`) alongside
  the 7 demo-seed leftover countries — fixed during Phase 4B checkout
  research; see `PROJECT_MEMORY.md` "Checkout architecture."

## Current API state

- Medusa exposes its standard **Store API** (`/store/*`) and **Admin API**
  (`/admin/*`) — no custom API routes exist (the two example stub routes from
  the scaffold were deleted as dead code during the audit).
- Storefront has **no `route.ts` API handlers of its own** — Server
  Components fetch data directly, and *mutations* (cart, checkout) go
  through Server Actions (`lib/actions/cart.ts`, `lib/actions/checkout.ts`,
  `lib/actions/recently-viewed.ts`), which are RPC-style functions callable
  from Client Components, not routed HTTP endpoints — the "no API routes"
  property is still intact in the sense that matters (no hand-rolled REST
  layer to keep in sync with Medusa's).

## Current components created

See "Current file structure" above for the full list — nothing has been
started and left half-built; every component listed is complete for its
current scope. `AddToCartButton` and `ProductCard`'s quick-add are now real
(Phase 4A), not inert — see `CHANGELOG.md`.

## Current pages completed

`/`, `/[category]`, `/[category]/[subcategory]`, `/proionta/[handle]`,
`/kalathi`, `/checkout`, `/checkout/epibebaiosi`, `/anazitisi`,
`/lista-epithymion`, `/nea-afiksi`, `/protainomena`, `/robots.txt`,
`/sitemap.xml`. Category/subcategory/search/New-Arrivals/Recommended
listings now infinite-scroll (2026-08-11) — see `PROJECT_MEMORY.md`'s
architecture section. Everything else linked from the header/footer
(account, footer content pages) is a real link to a route that doesn't
exist yet.

## Current integrations completed

- **GitHub**: connected, authenticated, pushed.
- **Supabase**: connected, real data persisted there.
- **Vercel**: connected per the user, **not yet used for anything** — no
  deployment configured.
- **Medusa Admin**: working, reachable, real catalog visible.
