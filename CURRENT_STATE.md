# Current State

Snapshot as of 2026-08-08 (Phase 4B: checkout, designed and built). This
documents **what exists right now**, verified by inspection — not
aspiration. Cross-check against `git log` / the actual file tree if this
ever feels stale; update it whenever a session ends.

Git state as of the last commit (`781c132`, Phase 3): `main` branch, clean,
pushed and in sync with `origin/main`. Everything from Phase 4 (related
products, recently viewed) through Phase 4B (checkout) described below has
been built and verified (`tsc`/`eslint`/`next build`, manual in-browser
checks against the real backend, and — for checkout specifically — a real
completed guest order through the actual UI) but **not yet committed** —
check `git status` before assuming any of it is on `origin/main`.

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

Phase 3 is committed on `main` and pushed to
[thmavrakis7777/eshop7777](https://github.com/thmavrakis7777/eshop7777).
Phases 4 through 4B are **not yet committed** (see git state note above).

## What is working (verified in-browser this session)

- Homepage: hero, category grid, featured-products rail, editorial banner,
  new-arrivals rail, trust strip, reviews, newsletter form (UI only, no backend) —
  all rendering real Medusa data except the reviews section (static placeholder
  testimonials, not tied to a review system).
- Header: sticky, mega menu (desktop, real subcategories + featured tile per
  category), mobile hamburger → drawer (real categories, working focus trap,
  Escape-to-close, focus return), search icon toggles a plain input (no
  predictive search backend).
- Footer: real category links, static help/company/legal links (those target
  pages don't exist yet — see "Known gaps" below).
- Category pages `/[category]` — e.g. `/kouzina`: real products (including
  from all subcategories, not just products tagged directly on the parent),
  subcategory chips, sort control (newest/title/price), pagination, breadcrumb
  with `BreadcrumbList` JSON-LD.
- Subcategory pages `/[category]/[subcategory]` — e.g. `/kouzina/tigania`:
  same as above, scoped to one subcategory.
- Product detail page `/proionta/[handle]`: real title/price/description,
  breadcrumb, `Product` JSON-LD, a **real, working** "Add to cart" button
  (Phase 4A — no longer inert). A "Σχετικά προϊόντα" (related products) rail
  — same-category cross-sell, server-fetched — and a "Είδατε πρόσφατα"
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
- **Stock disappearing mid-checkout** — same limitation as the cart's own
  untested insufficient-stock UI path (below): the Store API doesn't expose
  per-variant stock counts, so there's no way to deliberately reduce a
  product to zero and retry checkout without directly manipulating the
  database.
- **The "insufficient stock" cart error path in-browser** — verified
  directly against the live API (confirmed Medusa returns
  `insufficient_inventory` and the action maps it to the right Greek copy),
  but not re-confirmed by clicking "+" enough times in the actual UI to hit
  a real ceiling, since the Store API doesn't expose per-variant stock
  counts to know where that ceiling is (see `PROJECT_MEMORY.md`).
- **Cart under multiple concurrent tabs/sessions** — not tested; the cookie-
  based single-guest-cart model is standard Medusa practice but hasn't been
  stress-tested here.
- **Search** — the header search input has no backend; typing into it does
  nothing beyond local input state.
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
  today, so the variant-selection code path (if any is ever built) is
  completely unexercised.
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

components/
  layout/     AnnouncementBar, Header, Footer, MobileMenu
  home/       Hero, CategoryGrid, ProductRail, EditorialBanner, TrustStrip, Reviews, Newsletter
  category/   Breadcrumbs, CategoryPLPView, Pagination, SortControl
  product/    ProductCard, AddToCartButton, RecentlyViewedTracker, RecentlyViewed
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
                      ShippingOption, PaymentProvider, Order, OrderLineItem)
  medusa.ts           Store API fetch client + raw Medusa response types +
                       MedusaApiError (typed error class), MedusaCartCompleteResponse
                       (discriminated union for /carts/:id/complete)
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
                          getProductsByHandles, getRelatedProducts, getCartCrossSell
    cart.ts               getCart() — read-only, cookie-based, Server-Component-safe;
                          toDomainCart()/toAddressSummary() also used by lib/data/checkout.ts
    checkout.ts            getShippingOptionsForCart, getPaymentProviders, getOrder
  actions/
    recently-viewed.ts   Server Action bridging client-known handles → real product data
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
- **2 admin users**: `admin@stia.gr` (real, password not recorded in the
  repo) and `test-agent@stia.gr` (temporary, created during Phase 4A API
  verification — see `PROJECT_MEMORY.md`, safe to delete).
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
`/kalathi`, `/checkout`, `/checkout/epibebaiosi`, `/robots.txt`,
`/sitemap.xml`. Everything else linked from the header/footer (account,
wishlist, search, footer content pages) is a real link to a route that
doesn't exist yet.

## Current integrations completed

- **GitHub**: connected, authenticated, pushed.
- **Supabase**: connected, real data persisted there.
- **Vercel**: connected per the user, **not yet used for anything** — no
  deployment configured.
- **Medusa Admin**: working, reachable, real catalog visible.
