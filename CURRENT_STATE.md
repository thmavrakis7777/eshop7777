# Current State

Snapshot as of 2026-08-08 (Phase 5: product code/SKU, add-to-cart
everywhere, search — designed and built). This documents **what exists
right now**, verified by inspection — not aspiration. Cross-check against
`git log` / the actual file tree if this ever feels stale; update it
whenever a session ends.

Git state as of the last commit (`3de52dc`, Phase 4 through 4B): committed
to local `main`, **not yet pushed to `origin/main`** (last pushed commit is
`781c132`, Phase 3) — check `git status`/`git log` before assuming otherwise.
Phase 5 (this snapshot — product code, add-to-cart everywhere, search)
described below has been built and verified (`tsc`/`eslint`/`next build`,
manual in-browser checks against the real backend including a live
out-of-stock test via the admin) but is **not yet committed** on top of
`3de52dc`.

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
- **Phase 5**: permanent unique product code (Medusa's native `variant.sku`,
  no new field), search by code or name (Medusa's own `q` full-text search,
  no new search index), and add-to-cart from every product grid in the app
  with real stock-awareness and multi-variant gating — spec written and
  approved (`PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md`) before any code, built,
  and verified live including a real out-of-stock test via the admin. See
  "What is working" and `PROJECT_MEMORY.md` → "Product code /
  add-to-cart-everywhere / search architecture" for the details.

Phase 3 is committed on `main` and pushed to
[thmavrakis7777/eshop7777](https://github.com/thmavrakis7777/eshop7777).
Phases 4 through 4B are committed locally (`3de52dc`) but not pushed. Phase 5
is **not yet committed** (see git state note above).

## What is working (verified in-browser this session)

- Homepage: hero, category grid, featured-products rail, editorial banner,
  new-arrivals rail, trust strip, reviews, newsletter form (UI only, no backend) —
  all rendering real Medusa data except the reviews section (static placeholder
  testimonials, not tied to a review system).
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
  breadcrumb, `Product` JSON-LD (availability now reflects real stock, not
  hardcoded `InStock`), a **real, working** "Add to cart" button (Phase 4A —
  no longer inert; Phase 5 adds real stock-awareness — disabled +
  "Εξαντλήθηκε" at zero stock — and a plain radio-group variant picker for
  any product with >1 variant, untested against real data since the catalog
  is still 100% single-variant). A quiet "Κωδικός προϊόντος" row (Phase 5 —
  Medusa's native variant SKU) sits in the existing delivery/returns/payment
  metadata block. A "Σχετικά προϊόντα" (related products) rail —
  same-category cross-sell, server-fetched — and a "Είδατε πρόσφατα"
  (recently viewed) rail — client-side, `localStorage`-backed, resolved to
  real product data via a Server Action. See `CHANGELOG.md` for why
  "related" rather than "frequently bought together."
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
- **Add to cart from every product grid** (Phase 5): `ProductCard` — the one
  shared card component rendering on home, category/subcategory PLPs, PDP
  related/recently-viewed, cart cross-sell, and search results — now gates
  its quick-add on real stock (`Εξαντλήθηκε` badge + disabled button, not
  just a hover-only affordance) and real variant count (a product with >1
  variant shows an "Επιλογές" link to the PDP instead of guessing a
  variant). The quick-add/`Επιλογές` control is unconditionally visible on
  mobile (a desktop-only hover-reveal bug from Phase 4A meant it was
  literally unclickable on touch before this fix) and hover-revealed only
  at `md+`, matching the original desktop design.
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

- **Discounted products through the checkout flow specifically** —
  discount math (Έκπτωση) was verified in the cart and in the direct API
  dry-run before any UI was built, but not re-confirmed end-to-end through
  the checkout UI with a real discounted product in the order summary.
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
- **Lighthouse / Core Web Vitals / accessibility audit tooling** — accessibility
  fixes were made based on manual review + DOM inspection (focus management,
  ARIA), not run through axe/Lighthouse. No performance profiling done.
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

components/
  layout/     AnnouncementBar, Header, Footer, MobileMenu, SearchBox
              (debounced live-results dropdown, backed by
              lib/actions/search.ts — Header renders it inside its existing
              search-toggle panel)
  home/       Hero, CategoryGrid, ProductRail, EditorialBanner, TrustStrip, Reviews, Newsletter
  category/   Breadcrumbs, CategoryPLPView (also powers /anazitisi — takes
              optional extraParams/emptyMessage so a non-category listing
              doesn't need its own copy of the grid+pagination+sort chrome;
              basePath must be a pure path with no query string of its own),
              Pagination, SortControl
  product/    ProductCard (single shared card on every product grid in the
              app — real stock + multi-variant gating lives here, Phase 5),
              AddToCartButton (PDP — takes `product`, not `variantId`, since
              Phase 5; manages its own variant-selection state),
              RecentlyViewedTracker, RecentlyViewed
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
                      SKU) and `isAvailable` (real stock, Phase 5).
  medusa.ts           Store API fetch client + raw Medusa response types +
                       MedusaApiError (typed error class), MedusaCartCompleteResponse
                       (discriminated union for /carts/:id/complete).
                       MedusaVariant gained inventory_quantity/
                       manage_inventory/allow_backorder (Phase 5 — these
                       require explicit `+variants.*` fields, not returned by
                       default).
  format.ts           Price formatting (el-GR locale) + discountPercent()
  checkout-validation.ts   isValidEmail/isValidPhone/isValidPostalCode/isRequired
  site-config.ts       siteUrl / siteName (single source)
  search-params.ts     Safe sort/page query-param parsing
  recently-viewed-storage.ts   localStorage read/write for recently-viewed handles
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
                          isVariantAvailable (Phase 5 — the real-stock rule)
    cart.ts               getCart() — read-only, cookie-based, Server-Component-safe;
                          toDomainCart()/toAddressSummary() also used by lib/data/checkout.ts
    checkout.ts            getShippingOptionsForCart, getPaymentProviders, getOrder
  actions/
    recently-viewed.ts   Server Action bridging client-known handles → real product data
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
- **3 admin users**: `admin@stia.gr` (real, password not recorded in the
  repo), `test-agent@stia.gr` (temporary, created during Phase 4A API
  verification), and `qa-agent@stia.gr` (temporary, created during Phase 5
  to reach the inventory-editing UI for a live out-of-stock test — see
  `PROJECT_MEMORY.md`; both temporary accounts are safe to delete whenever
  convenient).
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
`/robots.txt`, `/sitemap.xml`. Everything else linked from the header/footer
(account, wishlist, footer content pages) is a real link to a route that
doesn't exist yet.

## Current integrations completed

- **GitHub**: connected, authenticated, pushed.
- **Supabase**: connected, real data persisted there.
- **Vercel**: connected per the user, **not yet used for anything** — no
  deployment configured.
- **Medusa Admin**: working, reachable, real catalog visible.
