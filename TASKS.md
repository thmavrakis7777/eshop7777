# Tasks

Roadmap phases as originally scoped, tracked here so progress survives across
sessions. Mark items done as they land; add new ones as scope becomes concrete
(don't pre-fill far-future phases with guesses).

**For "where do I resume", read `NEXT_STEPS.md` — it's more precise than this file.**
This file is the full roadmap; `NEXT_STEPS.md` is the pointer to exactly one place
in it.

## Completed

**Phase 0 — Research, IA, design system.**

**Phase 1 — Storefront foundation, homepage.** Next.js 16 scaffold, design
tokens, base layout, homepage sections, SEO shell. See `CHANGELOG.md` for bugs
found/fixed during this phase.

**Phase 2 — Medusa backend on Supabase, real catalog.** Backend scaffolded,
connected to Supabase Postgres, real catalog seeded (28 categories, 16
products), GitHub connected and pushed.

**Phase 3 — Full audit of Phases 1–2, then storefront wired to real Medusa
data.**

- [x] Full engineering audit — real bugs found and fixed (invalid nested
      interactive elements, missing focus management, broken JSON-LD, CORS
      misconfiguration, weak default secrets, dead code). Full list in
      `CHANGELOG.md`.
- [x] Store API client (`lib/medusa.ts`) + typed response shapes
- [x] Data adapters (`lib/data/categories.ts`, `lib/data/products.ts`) mapping
      Medusa responses into the storefront's own domain types
- [x] Header/Footer/MobileMenu/CategoryGrid/homepage switched from static mock
      data to server-fetched real data
- [x] Category PLP pages (`/[category]`, `/[category]/[subcategory]`) — real
      products, sort (newest/title/price), pagination, breadcrumbs, SEO
      metadata, `BreadcrumbList` JSON-LD
- [x] Product detail page (`/proionta/[handle]`) — minimal but real: real
      price/description, `Product` JSON-LD, breadcrumb. Gallery is still a
      placeholder tile (no real photography); no bundles/reviews/Q&A yet —
      those are explicitly Phase 4 scope, not cut corners.
- [x] `sitemap.ts` rewired to enumerate the real catalog instead of mock data
- [x] `mock-data.ts` deleted once nothing referenced it
- [x] Fixed: Medusa's default demo region didn't include Greece — added it,
      plus a Greek tax region (real business-logic bug, not just a data
      migration nicety)
- [x] Fixed: top-level category pages (e.g. `/kouzina`) showed 0 products —
      products are tagged with one specific subcategory, and Medusa doesn't
      auto-include descendants when filtering `/store/products` by
      `category_id`; `getCategoryIdsForHandle` now resolves the category
      itself + direct children before querying
- [x] Full re-verification: `tsc`/`eslint`/`next build` clean, manual
      in-browser check of homepage/mega menu/mobile menu/category/subcategory/
      product pages with real data
- [x] `PROJECT_MEMORY.md`, `TASKS.md`, `CHANGELOG.md`, `CURRENT_STATE.md`,
      `NEXT_STEPS.md` created/updated as the session-end handoff

## Completed (continued)

**Phase 4A — Cart experience.** Spec (`CART_UX_SPEC.md`) written, reviewed,
and approved by the user; then built end-to-end and verified against the
live Medusa backend.

- [x] Live Medusa cart/promotion/shipping-option API verification before
      writing any adapter code — cart create, line-item add/update/remove,
      promotions apply/remove, shipping options. Found real, non-obvious
      shapes (line-item update is `POST` not `PATCH`; delete's updated cart
      comes back under `parent`, not `cart`; promotions removal is `DELETE`
      with a body; inventory limits are enforced server-side but per-variant
      stock counts aren't exposed on the products endpoint). Full list in
      `CHANGELOG.md` and `PROJECT_MEMORY.md` → "Cart architecture."
- [x] Cart domain types (`lib/types.ts`), raw Medusa types + typed error
      class (`lib/medusa.ts`), read-only `getCart()` (`lib/data/cart.ts`),
      mutation Server Actions with Greek error mapping
      (`lib/actions/cart.ts`)
- [x] `cart_id` cookie persistence (30-day guest cart, survives refresh —
      verified)
- [x] `CartUIProvider` (drawer open/close + add-to-cart toast — UI-only
      client state, not cart data), `AddToCartToast`, `CartDrawer` (desktop
      side panel / mobile full-screen, reuses `MobileMenu`'s focus-trap
      pattern, verified: Escape closes, Tab wraps, focus returns to trigger)
- [x] Shared components: `CartLineItemRow`, `QuantityStepper` (optimistic,
      reconciled from the server response), `CouponForm` (collapsed by
      default; default/applying/success/invalid/expired states — verified
      live with both an invalid and a real activated promotion code),
      `FreeShippingProgress` (`lib/cart-config.ts` threshold, configurable,
      not hardcoded), `EmptyCartState` (reuses `RecentlyViewed`)
- [x] Full cart page `/kalathi` — two-column desktop / single-column mobile,
      cross-sell rail (`getCartCrossSell`, same honest same-category signal
      as PDP related products, not a fabricated "bought together" claim),
      empty state, verified persists across a real page reload
- [x] `AddToCartButton` and `ProductCard`'s quick-add wired to the real
      `addLineItemAction` — no longer inert. Header cart icon shows the real
      item count and opens the drawer.
- [x] Full verification: `tsc`/`eslint`/`next build` clean (backend live);
      manual in-browser — add/merge-quantity, optimistic + reconciled
      quantity updates, remove → empty-state transition (both drawer and
      full page), invalid + valid coupon codes, free-shipping bar, mobile
      full-screen drawer width, keyboard Escape + Tab-trap + focus return,
      cart persistence across a hard page reload

## Completed (continued)

**Phase 4A.1 — Cart clarity/UX revision.** The functionally-complete cart
above was hard to read at a glance (no column headers, unlabeled prices, no
shipping line) — a follow-up brief asked for a clarity-focused redesign
(labels, table structure, discount treatment) without touching the working
Medusa integration. Proposed (ASCII wireframes, exact Greek labels, decision
rationale) and approved before coding, per the same design-first pattern as
the original cart spec.

- [x] Desktop full cart page (`/kalathi`, lg+) is now a true 5-column table
      — `ΠΡΟΪΟΝ | ΑΡΧΙΚΗ ΤΙΜΗ | ΤΙΜΗ | ΠΟΣΟΤΗΤΑ | ΣΥΝΟΛΟ` — via
      `CartTableHeader` + `CartLineItemTableRow`, sharing one grid-column
      definition (`cart-table-grid.ts`) so header and rows can't drift out
      of alignment.
- [x] Drawer (always) and full page below lg use a purpose-built labeled
      card (`CartLineItemRow`: "Αρχική τιμή:"/"Τιμή:"/"Ποσότητα:"/"Σύνολο:")
      — not the desktop table squeezed narrower.
- [x] Discount treatment: a `-X%` badge next to the line price
      (`discountPercent` in `lib/format.ts`), no discount badge/row at all
      for non-sale items (no fake "0%" clutter), struck-through original
      price gets a "–" placeholder in the table's ΑΡΧΙΚΗ ΤΙΜΗ column when
      there's no discount, keeping every row the same height.
- [x] `CartTotals` extracted (was duplicated inline in the drawer and full
      page) — adds the **Μεταφορικά** line the original build was missing
      entirely: `Υπολογίζεται στο checkout` plus a one-line note under
      `Σύνολο`, since Medusa doesn't calculate shipping until checkout and
      showing a fake `0,00€` would be exactly the ambiguity being fixed.
- [x] Coupon success state relabeled from an inline `CODE · -amount`
      fragment to explicit `Κωδικός: / Έκπτωση:` lines.
- [x] Checkout CTA relabeled `ΠΡΟΧΩΡΗΣΗ ΣΤΟ CHECKOUT`; added a
      `Συνέχεια αγορών` secondary link to both the drawer (closes it) and
      the full page (links to `/`) — the non-empty cart previously had no
      continue-shopping affordance at all, a real gap against the original
      approved spec.
- [x] `QuantityStepper` unified to 44px targets at every width (was 32px on
      desktop).
- [x] **Real bug found and fixed during verification**: `getCart()` crashed
      every page (it's called from `RootLayout`) if a promotion applied to
      the cart was later deleted/deactivated — Medusa returns `null` in
      `cart.promotions` for the dangling reference, and the mapper assumed
      every entry was a real object. Fixed with a null-filter in
      `lib/data/cart.ts`; found by deliberately deleting a live test
      promotion while it was applied, not a theoretical concern.
- [x] Verified: `tsc`/`eslint`/`next build` clean; manual in-browser with a
      real Medusa sale price list (product-level discount) and a real
      promotion code — single item, multiple items, discounted line,
      non-discounted line ("–" placeholder), quantity 1 and >1, remove →
      empty state, coupon apply/remove, free-shipping bar both below- and
      above-threshold, 375px mobile width (no horizontal scroll), desktop
      table alignment. Long product names and multi-variant products
      verified by code inspection (no truncation classes; variant line was
      already conditional) rather than a live long-name product, since none
      exists in the current catalog.

## Completed (continued)

**Phase 4B — Checkout.** Design proposed (`CHECKOUT_UX_SPEC.md`) after live
Medusa verification surfaced three groundwork decisions (shipping zone gap,
unbacked free-shipping promise, single payment provider), all resolved with
the user before coding; then built end-to-end and verified against the live
backend, including a real, complete guest order.

- [x] **Real backend gap found and fixed before any UI work**: Greece was
      never added to the shipping fulfillment service zone (only the sales
      region and tax region, back in Phase 2/3) — confirmed live, Greek
      addresses resolved zero shipping options. Fixed via the Admin API
      (`POST /admin/fulfillment-sets/:id/service-zones/:id`, which replaces
      the whole `geo_zones` array, not appends) and reverified.
- [x] The cart's unbacked "free shipping over €X" promise (Phase 4A.1 found
      one instance; a *second*, separately hardcoded and mismatched
      instance was found on `AnnouncementBar` while fixing this) softened
      per explicit decision rather than backed with a real rule yet.
- [x] Payment method decided: the one real Medusa provider
      (`pp_system_default`) presented honestly as "Αντικαταβολή" (Cash on
      Delivery) — not "Κάρτα," which would be false, since no card
      processor is configured. `TrustStrip`/PDP copy still overclaims this
      and needs reconciling (flagged, not yet fixed — out of scope for this
      pass).
- [x] **Real bug found in existing (already-shipped) cart totals**: Medusa's
      `cart.subtotal` silently includes shipping once a shipping method is
      set — never visible before because no cart had ever had one. Fixed by
      switching to `item_subtotal` for the "Υποσύνολο" row and adding
      `shippingTotal`/`hasShippingMethod` to the `Cart` domain type;
      `CartTotals` now shows the real shipping amount once checkout sets a
      method instead of always saying "Υπολογίζεται στο checkout."
- [x] Single-page checkout (not a wizard) — numbered sections (Email →
      Στοιχεία παραλήπτη → Διεύθυνση παράδοσης → Τρόπος αποστολής →
      Πληρωμή), each auto-saving to the same Medusa cart as the customer
      fills it in (`lib/actions/checkout.ts`), shipping options resolved
      live once the address is complete, real-time order summary updates.
- [x] Guest-only, verified: email is just a cart field, no account/login
      anywhere in the flow.
- [x] Full order completion flow wired to the real Medusa endpoints
      (payment collection → payment session → cart complete), each verified
      live before being coded against — found real shapes (cart completion
      returns a discriminated union, `{type:"order"}` vs `{type:"cart",
      error}`, not a thrown error on failure).
- [x] Order confirmation page `/checkout/epibebaiosi` — own URL (survives
      refresh/bookmark), order re-fetched by ID (confirmed guest lookup
      works with just the publishable key), order number, itemized totals,
      delivery address, "τι γίνεται τώρα" timeline, optional non-blocking
      account-creation link.
- [x] Cart → checkout CTA relabeled `ΟΛΟΚΛΗΡΩΣΗ ΑΓΟΡΑΣ`; final submit is
      deliberately different wording, `ΟΛΟΚΛΗΡΩΣΗ ΠΑΡΑΓΓΕΛΙΑΣ` with the total
      on the button itself — see `CHECKOUT_UX_SPEC.md` §16 for the EU
      Consumer Rights Directive reasoning behind the distinction.
- [x] **Two real bugs found and fixed during live UI verification** (not
      caught by `tsc`/`eslint`, only by actually clicking through the
      flow): (1) all background saves (email/address/shipping) shared one
      `useTransition` with the final-submit button, so the button flashed
      "Επεξεργασία…" while the address was just autosaving, implying the
      order was being processed when it wasn't — split into independent
      pending state per concern. (2) an early mobile-reorder attempt moved
      the order summary's actual DOM position instead of using CSS `order`,
      which fixed mobile but silently flipped the desktop two-column layout
      (form and summary swapped sides) — reverted to DOM order matching
      desktop's natural reading order, with `order-first lg:order-none`
      doing the mobile-only visual reordering instead.
- [x] Mobile: order summary collapsed (native `<details>`, total always
      visible even collapsed) appears first, above Email — verified via
      real `getBoundingClientRect` measurements, not text-order tools
      (`innerText` doesn't reflect CSS `order`, a real gotcha hit while
      verifying this). Submit CTA is a real `position: fixed` bottom bar,
      confirmed pinned to the exact viewport edge.
- [x] Verified end-to-end with a **real completed order** through the
      actual UI (not just direct API calls): added a product, filled the
      form, hit an invalid-email/invalid-phone/invalid-postal-code error
      state (all three inline, correctly scoped to only touched fields),
      corrected them, selected a real shipping method (order summary
      updated live), submitted, landed on the confirmation page with a real
      order number, confirmed the cart was cleared afterward (cookie
      deleted, header badge reset to 0), confirmed the confirmation page
      survives a hard refresh. Also verified: empty-cart → `/checkout`
      redirects to `/kalathi`; 375/768/1280px widths, no horizontal scroll
      at any of them. `tsc`/`eslint`/`next build` all clean throughout.

## Completed (continued)

**Phase 5 — Product code (SKU), add-to-cart everywhere, search.** Explicit
instruction to inspect the current implementation and propose an
architecture before writing code — `PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md`
written and approved (three open decisions: multi-variant grid behavior,
code display location, search UI shape) before any implementation, same
pattern as cart/checkout.

- [x] Product code = Medusa's native `variant.sku`, not a new field —
      confirmed live all 16 real products already have unique, non-null
      SKUs and Medusa enforces uniqueness at the DB level itself. Mapped
      through as `ProductVariant.code`/`Product.code`; displayed as
      `Κωδικός προϊόντος` on the PDP only (not grid cards, by design).
- [x] Search reuses Medusa's own `q` full-text search (confirmed live it
      already indexes both title and variant SKU) — no new search
      index/service. `searchProducts()` in `lib/data/products.ts`, a
      debounced header dropdown (`SearchBox.tsx`, `lib/actions/search.ts`),
      and a full `/anazitisi` results page reusing `CategoryPLPView`
      (which gained `extraParams`/`emptyMessage` props for this without
      breaking the category pages).
- [x] Real per-variant stock now fetched (`+variants.inventory_quantity`,
      `manage_inventory`, `allow_backorder`) and mapped to
      `ProductVariant.isAvailable` — corrects an earlier (wrong) note that
      this field was unavailable via the Store API. `ProductCard` and
      `AddToCartButton` gate on it: `Εξαντλήθηκε`, disabled, both as a grid
      badge and on the PDP.
- [x] Multi-variant guard: `ProductCard` no longer blindly adds
      `variants[0]` — a product with >1 variant shows an `Επιλογές` link to
      the PDP on grid cards (user decision, over building a speculative
      inline popover selector with no real multi-variant product to verify
      it against) and a plain radio-group picker on the PDP itself
      (`AddToCartButton` reworked to take `product`, not `variantId`).
- [x] **Real, separate bug found during verification**: the quick-add
      button was `hidden` below Tailwind's `md` breakpoint (a leftover
      desktop-hover-reveal pattern from Phase 4A) — `display: none` on an
      actual mobile viewport, not just less discoverable. Mobile users
      could not add to cart from any grid before this fix. Confirmed via
      `getComputedStyle()`, fixed by making the control unconditionally
      visible below `md`.
- [x] Verified live: search by exact SKU/partial SKU/Greek name (dropdown
      and results page); code displays on PDP; a real product's stock
      zeroed via the admin and `Εξαντλήθηκε` confirmed on both PDP and grid
      card, then restored; quick-add from a grid card confirmed at a real
      375px mobile viewport (cart badge updated, no drawer auto-opened).
      `tsc`/`eslint`/`next build` all clean. Not re-verified: discounted
      product + coupon-after-quick-add (no active promotion in the live
      catalog to test against; neither code path was touched this phase).

## Completed (continued)

**Production readiness audit — Phases 1–5.** A gated whole-codebase pass
before any further feature work: code review, performance, SEO, Core Web
Vitals, accessibility (WCAG AA), Medusa architecture, cleanup, and the full
`tsc`/`eslint`/`next build`/`medusa lint` gate. Findings verified against
the running app, not reasoned about. Full narrative in `CHANGELOG.md`.

- [x] **Fabricated homepage customer reviews deleted** — three invented,
      named testimonials with hardcoded star ratings under "Τι λένε οι
      πελάτες μας". Same class of bug as the Phase 3 fake 4.6-star ratings,
      plus real EU Omnibus Directive exposure for fake consumer reviews.
- [x] **Checkout keyboard-focus bug fixed** — every contact/address/email
      input carried `disabled={saving}`, so the background autosave dropped
      focus to `<body>` the moment a customer tabbed past the last field.
      Measured live before and after; saving state moved to a
      `role="status"` indicator on `SectionHeading`.
- [x] **Payment-method overclaims reconciled in all three places** —
      `TrustStrip`, the PDP delivery block (both previously flagged in this
      file) and the footer payment-badge row (a *new* finding) all
      advertised card/Viva Wallet. Delivery windows aligned to the real
      Medusa `Standard Shipping` estimate (2-3 εργάσιμες).
- [x] **Two broken homepage links removed** — "Δες όλα →" on both product
      rails pointed at `/prosfores` and `/nea-afiksi`, neither of which has
      ever existed (verified 404).
- [x] **SEO defects fixed**: `/anazitisi` was indexable *and* canonicalised
      to the homepage (inherited the root layout's `canonical: "/"`);
      `/checkout/epibebaiosi` had the same inherited-canonical bug;
      paginated category pages didn't self-canonicalise; `/checkout` was
      crawlable. Also added the real Medusa SKU to the PDP's `Product`
      JSON-LD.
- [x] **Security hardening**: `cart_id` cookie now `httpOnly` + `secure` in
      production; baseline security headers + `poweredByHeader: false` in
      `next.config.ts`. CSP deliberately deferred (needs nonces for the
      inline JSON-LD).
- [x] **Redundant Medusa requests removed**: `Cart` now carries `regionId`,
      killing both `regionIdForCart()`'s extra cart fetch in order
      completion and `/checkout`'s `getDefaultRegionId()` call. PDP's
      three-deep category→parent→related waterfall flattened.
- [x] **Accessibility**: removed bogus `role="menu"`/`role="menuitem"` from
      the mega menu, made its trigger actually do something on activation
      (open-only — a toggle regressed the hover flow, caught live and
      corrected), `role="img"` on `Stars`, live-region announcement for the
      header search dropdown, `next/link` for category subcategory chips.
- [x] **Colour contrast verified against WCAG AA** — all token pairs pass;
      tightest is ink-muted on surface-strong at 4.58:1. Recorded in
      `PROJECT_MEMORY.md` so it isn't recomputed.
- [x] **Dead code removed**: `StarIcon`, the `CartController` type,
      `FormField`'s `disabled` prop, and the unused
      `--color-accent-strong`/`--color-accent-soft` tokens.
- [x] Verified: `tsc`/`eslint`/`next build` clean (storefront),
      `medusa lint` clean (backend), plus live in-browser verification of
      every fix listed above.

## Completed (continued)

**Product card redesign, wishlist, stock display, PDP content.** Explicit
instruction to inspect the current implementation and propose an
architecture (with a short, non-copying look at how established Greek
home-goods retailers structure cards/PDPs) before writing code —
`PRODUCT_CARD_WISHLIST_PDP_SPEC.md` written and approved (two open
decisions: card hierarchy, specs data source) before implementation.

- [x] **Card hierarchy reordered and reviewed, not just implemented as
      asked** — recommended title/price come before stock/button rather
      than the user's own first draft (button first), explained why, user
      took the recommendation. Final: image (wishlist heart) → title →
      code → price → stock → Add to Cart, now a real row instead of an
      absolutely-positioned hover overlay — retires Phase 5's desktop-hover/
      mobile-always-visible CSS split entirely.
- [x] **Wishlist**: `localStorage`-only, same proven shape as "recently
      viewed" — no Medusa wishlist module exists, and no customer auth
      system exists to hang a real one off. Built as a real external store
      (`lib/wishlist-storage.ts`) via `useSyncExternalStore`, not a naive
      mount-effect (would cause a real SSR/hydration mismatch). Real
      `/lista-epithymion` page replaces the placeholder that's 404'd since
      Phase 1.
- [x] **Real bug caught live during this build**: `getServerSnapshot`
      returning a fresh `[]` literal every call tripped React's "should be
      cached to avoid an infinite loop" — fixed with a stable module-level
      constant.
- [x] **Stock status**: new shared `StockStatus` component
      (`Σε απόθεμα`/`Εξαντλήθηκε`), one place for this wording/color, used
      by both the card and PDP. First real use of the `--color-success`
      token (existed since Phase 1, unused until now).
- [x] **PDP Description + Characteristics sections**: confirmed live that
      Medusa's native product schema already has
      material/weight/length/width/height/origin_country — no new field —
      but all 16 real products have every one empty today. Renders only
      populated fields, disappears entirely when none exist, rather than
      inventing plausible specs (same anti-fabrication standard as
      fake-reviews/ratings elsewhere). Description promoted to its own
      `<h2>Περιγραφή</h2>` section.
- [x] Verified live: wishlist toggle → header count → persistence →
      `/lista-epithymion` → empty state, no reload needed anywhere; a real
      out-of-stock test (via the Admin API directly, after the admin
      dashboard's UI proved unreliable to drive through browser automation)
      confirmed and restored on both card and PDP; 375/768/1280px all
      zero horizontal overflow; a real long product name wraps cleanly;
      `/kalathi`'s cross-sell rail (also `ProductCard`) unaffected.
      `tsc`/`eslint`/`next build` all clean. Not re-verified: a discounted
      product's rendering (no active promotion in the live catalog; the
      discount code path itself wasn't touched).
- [x] **Known, pre-existing gap flagged, not fixed** (out of scope for this
      task): the header's wishlist icon is `hidden sm:block` (same as the
      account icon always has been) — no header entry point to
      `/lista-epithymion` below the `sm` breakpoint. The heart-toggle
      interaction itself works everywhere on mobile; fixing the header
      entry point means touching `MobileMenu`.

**Premium Greek checkout, Phase 1 — Store Pickup.** User brief: build a
premium, high-converting Greek checkout across delivery options (BOX NOW +
Store Pickup), address autocomplete, billing address, tax documents (ΑΦΜ/
AADE), payment methods, order emails, and cart/wishlist persistence.
Architecture review written first (`CHECKOUT_PREMIUM_SPEC.md`), covering all
13 review points from the brief per feature area, before any code — same
spec-first pattern as every prior phase. User decided: BOX NOW deferred
(needs a real merchant/partner relationship, not self-serve), Stripe first
for payment, ΓΕΜΗ Open Data for ΑΦΜ lookup, customer accounts out of scope
this phase. Phase 1 (Store Pickup) then built and verified:

- [x] **New Medusa fulfillment-provider module**
      (`apps/backend/apps/backend/src/modules/store-pickup`) — extends
      `AbstractFulfillmentProviderService`, registered in `medusa-config.ts`
      alongside the existing manual provider (Medusa does not merge custom
      providers into its defaults — confirmed against the official docs live
      via the Medusa MCP/docs fetch — the manual provider had to be listed
      explicitly or Standard/Express shipping would have broken).
      Regression-tested live: both existing options still resolve correctly
      for a Greek address after the config change.
- [x] A new `Παραλαβή από το κατάστημα` shipping option created via the
      Admin API (`shipping_option_type.code = "pickup"`, price €0, using the
      new provider) on the same service zone Standard/Express already use.
      **Real bug hit while creating it**: passing Greek text through a bash
      heredoc/curl command mangled the UTF-8 bytes before they reached the
      API — fixed by writing the update as a `.mjs` script file (Write tool,
      not inline shell) and running that instead. Worth remembering for any
      future Admin API call carrying Greek text — never pass Greek literals
      inline in a shell command on this machine.
- [x] Storefront: `ShippingOption.isPickup` (derived from `type.code`,
      `lib/data/checkout.ts`), `ShippingSection.tsx` shows a
      `PickupLocationInfo` block (name/address/hours/instructions) once the
      pickup option is selected, and a zero-amount option renders "Δωρεάν"
      instead of "0,00 €". Pickup location content lives in a new
      `lib/pickup-config.ts` — **placeholder data** (address/ΤΚ are
      obviously-marked placeholders, not fabricated to look real) — needs
      STIA's real pickup address before this ships to real customers.
- [x] Verified live end-to-end: address entry → all three shipping options
      appear (Standard/Express/Pickup) → selecting Pickup shows the location
      block and drops the order total by the shipping amount immediately,
      matching the existing shipping-method-selection UX. `tsc`/`eslint`/
      `next build` clean on the storefront; `tsc --noEmit`/`medusa lint`
      clean on the backend.
- [x] Real pickup address entered (Σφακιανάκη 4, 71201 Ηράκλειο) and real
      per-day opening hours (handles the split Tue/Thu/Fri shifts honestly
      instead of a collapsed range) — verified live in the browser at
      desktop and mobile widths, no console errors, no horizontal overflow.

**Premium Greek checkout, Phase 2 — billing address + tax documents.**

- [x] Billing address toggle (unchecked by default), billing_address
      written alongside shipping_address in the same Medusa cart update —
      unchecking re-mirrors it immediately rather than leaving a stale
      custom address on the server.
- [x] Tax document toggle (Απόδειξη default / Τιμολόγιο), invoice fields
      (Επωνυμία/ΑΦΜ/ΔΟΥ/Δραστηριότητα) stored in cart.metadata (no native
      Medusa field). ΑΦΜ validated client-side via the standard Greek
      mod-11 checksum — a live ΓΕΜΗ lookup that autofills these is Phase 4,
      not built yet.
- [x] **Real finding, confirmed live**: cart metadata updates *merge*, not
      replace (opposite of the fulfillment geo_zones behavior) — and a real
      bug this caused (clearing fields via `undefined` silently did
      nothing, since JSON.stringify drops undefined keys) was caught and
      fixed with explicit `null`.
- [x] **Real accessibility bug found and fixed**: the collapsed billing/
      invoice field groups were still keyboard-Tab-reachable while
      invisible (a CSS grid-rows collapse doesn't block focus) — fixed with
      the HTML `inert` attribute, confirmed live.
- [x] Verified live end-to-end with a real completed test order (display_id
      3): different billing address + full Τιμολόγιο invoice details both
      round-tripped correctly into the real order. 375px mobile width: zero
      horizontal overflow, billing section expands cleanly.
      `tsc`/`eslint`/`next build` clean on the storefront.

**Premium Greek checkout, Phase 3 — address autocomplete.**

- [x] Google Places (New) integration, called server-side only via two new
      Server Actions (`lib/actions/address-autocomplete.ts`) — API key
      never reaches the browser, an improvement over the original
      client-side-widget plan.
- [x] `AddressAutocomplete.tsx` wraps the Οδός field: debounced dropdown,
      keyboard nav, autofills Οδός/Αριθμός/Πόλη/ΤΚ without ever overwriting
      a field the customer already typed into, degrades to a plain text
      field with zero errors when no API key is configured (verified live
      — this is the actual state today).
- [ ] **Not yet done**: real end-to-end verification against Google's
      actual API (needs a real `GOOGLE_PLACES_API_KEY` — none available
      this session) and the "map pin confirmation" visual from the
      original spec. `tsc`/`eslint`/`next build` clean regardless.

**Premium Greek checkout, Phase 4 — ΓΕΜΗ business lookup.**

- [x] `lib/actions/afm-lookup.ts`'s `lookupCompanyByAfm` — real API
      contract (endpoint, auth header, response shape) confirmed live
      against ΓΕΜΗ's own public Swagger spec, not guessed. Autofills
      Επωνυμία/Δραστηριότητα (only ΓΕΜΗ fields available — confirmed live
      there's no ΔΟΥ field at all) the moment a valid ΑΦΜ is entered,
      non-destructively (never overwrites an already-filled field).
- [x] **Real correction to the original research**: a working `GEMI_API_KEY`
      needs registration + approval, not instant self-serve as first
      assumed — still much lower friction than AADE/TAXISnet.
- [ ] **Not yet done**: real end-to-end verification against a real
      approved ΓΕΜΗ key (none available this session — confirmed the
      Swagger docs' own displayed test key is documentation-only and
      correctly 401s on a real call). Graceful no-key degrade path verified
      live. `tsc`/`eslint`/`next build` clean.

**Premium Greek checkout, Phase 5 — order confirmation emails.**

- [x] Real order-confirmation email on `order.placed`, via Medusa's
      notification module + SendGrid (substituted for the originally
      planned Resend — SendGrid is already a bundled dependency, needing
      zero new packages). Same "explicit module registration or it's
      silently lost" rule as fulfillment (Phase 1) applied to the built-in
      local provider.
- [x] Verified live with a real completed test order (display_id 4): the
      full real chain confirmed in backend logs — subscriber fired, email
      template built, SendGrid correctly rejected the placeholder key
      (401), the failure was caught and logged, and the order still
      completed successfully regardless.
- [ ] **Not yet done**: a real email actually landing in an inbox (needs a
      real `SENDGRID_API_KEY`, none available this session).
      `tsc`/`eslint`/`next build`/`medusa lint` all clean.

**Production quality audit (2026-08-10, user-requested).** Full review of
every file touched this session, performed as Sonnet 5 (no tool exists to
switch models mid-session).

- [x] Three real bugs found and fixed — none caught by earlier phase
      testing since it always filled every field before the first save:
      checking "different billing" before finishing it blocked the
      *shipping* save entirely; a race condition in the ΓΕΜΗ autofill
      (stale-snapshot overwrite of fresh typing); a race condition in the
      address-autocomplete debounce (out-of-order responses showing stale
      suggestions).
- [x] One real accessibility gap fixed: `aria-activedescendant` added to
      the address-autocomplete combobox (arrow-key navigation was silent
      for screen readers).
- [x] Two misleading comments corrected to match actual code behavior.
- [x] Confirmed clean: no dead code, unused imports, debug statements, or
      new dependencies across the full session diff. `tsc`/`eslint`/
      `next build` (storefront) and `tsc`/`medusa lint` (backend) all
      clean after every fix.

**Storefront UX polish — uniform card heights, header mini cart, Continue
Shopping transition (2026-08-10).** Three targeted fixes from a detailed
user brief; each scoped to its own component only, no architecture changes.

- [x] **Uniform product card heights** — `ProductCard.tsx`'s content block
      made `flex-1`, title `line-clamp-2` with a `min-h-10` reservation,
      Add to Cart button/`Επιλογές` link pinned to the card's bottom edge
      via `mt-auto`. One shared component, so this fixes home, category/
      subcategory PLPs, search, related products, and the wishlist page in
      one place. Verified live: a real long title and short titles in the
      same row produce byte-identical button top/bottom coordinates at
      375/768/1280px.
- [x] **Header mini cart** — `Header.tsx` now shows `formatPrice(cart.total)`
      beside the existing item-count badge (`sm:` breakpoint up; badge alone
      covers mobile), sourced from the same `getCart()` call `RootLayout`
      already made — no new fetch, no duplicated totals math. Updates live
      through the pre-existing `revalidatePath("/", "layout")` mechanism.
      Confirmed unchanged: quick-add never auto-opens the drawer.
- [x] **Continue Shopping + a real drawer transition** — the cart drawer had
      no open/close animation at all before this; added a slide/fade
      transition (`transform`/`opacity`, `motion-reduce`-aware) to all four
      close paths (X, Escape, backdrop, Continue Shopping) for consistency.
      Continue Shopping does a client-side `router.push("/")` only when not
      already on the homepage, then closes — cart/wishlist both already
      survive navigation untouched (cookie- and `localStorage`-backed
      respectively), nothing extra needed to "preserve" them.
- [x] **Real lint fix hit along the way**: first draft called `setState`
      synchronously inside two `useEffect` bodies, tripping this project's
      `react-hooks/set-state-in-effect` rule — fixed with React's
      "adjust state during render" pattern instead of an effect.
- [x] Verified live: button alignment across mixed title lengths; header
      total/count updating on quick-add with no page reload; drawer closing
      + navigating home with cart state intact (confirmed via a `window`
      marker surviving, ruling out a full reload); Continue Shopping from
      the homepage itself doing a plain close with zero navigation;
      375/768/1280px all zero horizontal overflow. `tsc --noEmit`, `eslint`
      (project-wide), and `next build` all clean.

**Greek-aware live search dropdown (2026-08-10, code complete — live
verification blocked, see below).** Architecture (normalization approach,
fuzzy strategy, ranking tiers, desktop/mobile wireframes) proposed and
approved before any code, same pattern as every prior feature.

- [x] `lib/search.ts` — Unicode NFD-based accent stripping + Greek sigma
      fold + whitespace normalization, a 7-tier ranking (SKU exact/partial,
      title exact/prefix/word, category, bounded fuzzy), hand-rolled
      Levenshtein (no new dependency). Verified standalone against every
      example in the brief (accented/unaccented, mixed case) — all pass.
- [x] `searchProducts()` rewritten in place (same signature) to rank a
      cached full-catalog fetch in-process instead of Medusa's `q` — one
      search implementation shared by `/anazitisi` and the dropdown, not a
      second system. Real bug caught during self-review before any testing:
      the category-match tier was indexing the Latin URL handle instead of
      the real Greek category name — fixed.
- [x] `lib/hooks/use-quick-add.ts` extracted from `ProductCard`'s inline
      logic, now shared with the new `SearchResultRow` — same add-to-cart/
      multi-variant-routing behavior on both surfaces, no duplicated logic.
- [x] `SearchResultRow.tsx` (new) — compact row, discounted-price hierarchy
      reused from `ProductCard`, multi-variant → "Επιλογές →" link (reuses
      `ProductCard`'s existing pattern rather than a new inline picker).
      Quick-add errors now surface inline (a gap caught during self-review).
- [x] `SearchBox.tsx` rebuilt — full ARIA combobox pattern mirroring the
      existing `AddressAutocomplete.tsx` precedent (arrow-key virtual nav,
      Enter/Escape, outside-click), subtle loading state, helpful Greek
      no-results copy.
- [x] Two `react-hooks/set-state-in-effect` violations hit and fixed with
      the same pattern already established for the cart drawer.
- [x] `tsc --noEmit` and `eslint` (project-wide) both clean.
- [x] **DNS blocker resolved**: `DATABASE_URL` switched from the direct
      connection to Supabase's session pooler (`aws-1-eu-west-1.pooler.supabase.com`,
      real IPv4), reusing the existing DB password — no new secret entered
      or exposed. See `PROJECT_MEMORY.md`'s "External services" for the
      full diagnosis.
- [x] `next build` (storefront) and `medusa lint` (backend) both clean
      with the live backend.
- [x] **Full live verification done against the real backend and real
      catalog** — Greek accented/unaccented/uppercase search, exact and
      partial SKU search, two typo cases via fuzzy matching, honest
      no-results copy for both a nonsense query and a real absent product,
      quick-add updating the header count/total without opening the
      drawer, keyboard Arrow/Enter/Escape, real outside-click, zero
      horizontal overflow at 320/375/768/1280px, a real 40×40px touch
      target. Full detail in `PROJECT_MEMORY.md`. Honest, not-fabricated
      gaps: no discounted or out-of-stock product exists in the live
      catalog today to exercise those two states, and the catalog is still
      100% single-variant (same standing gap as every other multi-variant
      code path in this project).

**Search dropdown layout fix, real product-image rendering, and cart
pricing/SKU/discount polish (2026-08-10).** Three follow-on fixes/features in
one session, each verified live against the real backend.

- [x] **Search dropdown bug fix**: `SearchResultRow`'s product-image tile was
      rendering full-row-width and hiding the title/SKU text behind it —
      `PlaceholderTile`'s own `w-full`/`aspect-square` classes always win over
      a `className` override (Tailwind utility precedence is stylesheet
      order, not class-string order), so `className="h-11 w-11 shrink-0"`
      never took effect. Fixed by wrapping it in a sized `<div>` instead —
      the same pattern `ProductCard` already used. Confirmed live.
- [x] **Real product-image rendering, storefront-wide gap closed**: the
      domain `Product` type never carried Medusa's `thumbnail` field through
      to any component — every product surface (search dropdown, grid cards)
      unconditionally rendered `PlaceholderTile`, so a real photo uploaded to
      Medusa today would render nowhere. Added `Product.imageUrl`
      (`toDomainProduct()` now maps `p.thumbnail`), a new shared
      `components/ui/ProductImage.tsx` (real `next/image` when a thumbnail
      exists, `PlaceholderTile` fallback otherwise — one place deciding this
      for both `ProductCard` and `SearchResultRow`), and a `next.config.ts`
      `images.remotePatterns` entry for Medusa's local file server
      (`localhost:9000/static/**`). Zero real product has a photo yet
      (confirmed via Store API), so this is unverified against a real photo
      end-to-end — the rendering path itself is verified live with zero
      regression (every card still shows its placeholder tile identically).
      PDP (`proionta/[handle]/page.tsx`) and cart/checkout line items still
      render `PlaceholderTile` directly, unchanged — out of scope here.
- [x] **Cart pricing/SKU/discount-badge polish (mini-cart drawer + main cart
      page)**: explicit brief to inspect existing pricing/discount logic
      first and reuse it — `discountPercent()` (`lib/format.ts`) and
      `compareAtUnitPrice` (from Medusa's real `compare_at_unit_price` cart
      field) already existed and were already shared by both surfaces, so no
      new discount calculation was written. Added the one real gap: SKU
      display. Medusa's line items already carry `variant_sku` by default
      (confirmed via a live Store API call, no extra `fields` needed) but it
      was never mapped through — added `CartLineItem.code`, wired in
      `toDomainCart()`, rendered as "Κωδικός: …" (secondary, smaller than the
      title) in both `CartLineItemRow` and `CartLineItemTableRow`. Upgraded
      the discount indicator from bare accent-colored text to a compact pill
      badge, reusing `ProductCard`'s existing "sale" badge treatment
      (`bg-accent text-white rounded-sm px-1.5 py-0.5 text-[11px]`) rather
      than inventing a new style. Deliberately kept the existing labeled
      rows ("Αρχική τιμή:" / "Τιμή:") in the drawer/mobile card layout rather
      than reverting to an unlabeled format — that labeling was itself a
      documented prior fix ("Cart clarity pass, 2026-08-08"). Also kept
      `ΑΡΧΙΚΗ ΤΙΜΗ` right-aligned (not center-aligned) in the desktop table,
      matching the `ΤΙΜΗ`/`ΣΥΝΟΛΟ` numeric columns already right-aligned next
      to it — center-aligning just one of three adjacent price columns would
      look inconsistent, not more aligned.
- [x] **Alignment verified, not just assumed**: no real bug existed —
      `getBoundingClientRect()` on live rows with three different title
      lengths confirmed every price cell already vertically centers on its
      row's tallest cell (`items-center` on the shared grid), and all three
      price columns share identical left/right pixel edges across every row,
      both with and without a discount badge present.
- [x] **Discount math verified against a deliberately messy number**: since
      no discounted product exists in the live catalog today, a transient,
      disclosed client-side-only override (`27.90 × 1.25 = 34.875`, reverted
      immediately after) confirmed `discountPercent()` still rounds to a
      correct `-20%` despite the non-round intermediate value — the
      floating-point-precision failure mode named in the brief.
- [x] `tsc --noEmit`, `eslint` (project-wide), and `next build` all clean.
      Live-verified: mini-cart drawer, main cart page desktop table (1280px)
      and mobile/tablet card layout (390px/768px), quantity increment/
      decrement recalculating line total and header total correctly, no
      fake discount badge/strikethrough on any real (non-discounted) product.

## Completed (continued)

**Dynamic New Arrivals, infinite scroll, homepage carousels (2026-08-11).**
Explicit brief requiring an architecture review (products/categories/
pagination/tags/homepage/carousel-library/SEO all inspected live) before
any code, with several open decisions explicitly delegated for a
recommendation rather than fully pre-specified — see `CHANGELOG.md` and
`PROJECT_MEMORY.md`'s new architecture section for the full detail.

- [x] **New Arrivals**: hybrid membership (30-day `created_at` window OR
      Medusa's native `"new"` product tag, admin-manageable, zero backend
      changes), `getNewArrivalsPaged()`, real `/nea-afiksi` page reusing
      `CategoryPLPView` (breadcrumbs/sort/SEO/pagination all reused), added
      to `sitemap.ts`, linked from the homepage rail.
- [x] **Infinite scroll** on category, subcategory, search, and New
      Arrivals listings — `PAGE_SIZE` 12→24, new `InfiniteProductGrid`
      Client Component + three Server Actions (`lib/actions/products.ts`),
      classic `Pagination` kept as a real `<noscript>` crawlable fallback,
      guarded against duplicate/concurrent requests and stale-listing
      appends. Two real bugs found and fixed live (a Server→Client
      function-prop 500, and an `IntersectionObserver` that stopped
      re-firing on short lists) — see `CHANGELOG.md`.
- [x] **Homepage carousels**: `ProductRail` converted to a native CSS
      scroll-snap horizontal track (no library), desktop keyboard-operable
      arrows, mobile native touch/swipe, both rails 4→12 products, real
      "Δείτε Περισσότερα" tile. New `/protainomena` ("Recommended
      Products") page + `getFeaturedProductsPaged()`, same pattern as New
      Arrivals. `ProductCard` untouched.
- [x] `tsc --noEmit`, `eslint`, and `next build` all clean throughout.
- [ ] **Not yet live-tested**: the New Arrivals tag-override branch against
      a real aged-out (>30 days) tagged product — no such product exists in
      the current 16-product catalog, all of which are still within the
      window. Code path is straightforward and type-checked; genuinely
      untested against real "old + tagged" data.

## Completed (continued)

**Cart price/discount alignment audit, verified against a real sale
(2026-08-11).** Requested audit of mini-cart/main-cart SKU/pricing/discount
presentation — inspection found the entire feature set already shipped in
a prior session (SKU, original+current price, discount badge, one shared
`discountPercent()`); nothing duplicated. See `CHANGELOG.md` and
`PROJECT_MEMORY.md`'s newest architecture entry for full detail.

- [x] Only real gap: desktop table's three price columns switched from
      right-aligned to centered (a prior session's deliberate right-align
      decision was re-flagged and explicitly overridden by the user this
      time — see `PROJECT_MEMORY.md`, don't trust the older right-align
      note as still current).
- [x] Live-verified against a real Medusa sale price list the user created
      (not simulated): exact 20% math, mixed-cart totals, pixel-identical
      column alignment (including the taller two-line discounted cell),
      quantity-change recalculation, mini-cart/main-cart parity, mobile
      (375px) zero-overflow, no drawer auto-open regression.
- [x] `tsc --noEmit`, `eslint`, and `next build` all clean.
- [x] Reset a forgotten local `admin@stia.gr` password via a proper
      `medusa exec` script through `AuthModuleService.updateProvider`, not
      raw SQL — see `PROJECT_MEMORY.md` for why (`medusa user` only
      creates, doesn't reset) and the CLI's ~100-150s cold-start note.

## Completed (continued)

**Full technical audit — bugs, dead code, performance, SEO (2026-08-11).**
Explicit "fix, don't just report" request, no new feature. See
`CHANGELOG.md`/`PROJECT_MEMORY.md` for full detail.

- [x] One real bug found and fixed: missing `data-scroll-behavior="smooth"`
      on `<html>` was causing every client-side navigation sitewide to do
      an animated scroll-to-top instead of an instant one (Next.js 16
      requirement, not caught by `tsc`/`eslint`).
- [x] Dead code: none found (orphaned-file cross-reference script, no
      duplicate pricing/discount/formatting logic, no debug leftovers).
- [x] Architecture: confirmed no direct Supabase/Postgres access anywhere
      in the storefront — Next.js → Medusa → Supabase intact.
- [x] SEO: verified metadata/canonical/JSON-LD/sitemap/robots.txt correct
      across every page type, including the two new pages from the prior
      session.
- [x] Live-verified desktop + mobile: New Arrivals, infinite scroll,
      carousels, cart (with the real sale still active), wishlist, search,
      mobile menu — zero console errors.
- [x] `tsc --noEmit`, `eslint`, `next build` (storefront) and `medusa lint`
      (backend) all clean, re-run after the fix.
- [ ] **Deliberately not touched** (see `CHANGELOG.md` for why): `next/font`
      dev-only preload warnings, `ProductCard`'s full-client hydration
      (already flagged in a prior audit), `next/image priority` (currently
      zero live impact — no real product photography exists yet).

## Admin-first platform

A large, multi-phase initiative (user-requested, 2026-08-11): make the
store manageable from the Medusa Admin without code changes for everyday
business/marketing/SEO tasks. Architecture review + phased roadmap
proposed and approved before any code — see `CHANGELOG.md`'s "Admin-first
platform, Phase A" entry and `PROJECT_MEMORY.md`'s matching architecture
section for full technical detail, and `ADMIN_GUIDE.md` for the end-user
reference this initiative is building up phase by phase.

**Phase A — Product SEO: done (2026-08-11).**
- [x] `seo` custom module (polymorphic `resource_type`/`resource_id` model,
      real migration applied to the live database)
- [x] Admin widget on the product detail page, shared `/admin/seo` +
      `/store/seo` routes, mutation through a proper workflow (not a
      direct service call — a real Medusa lint rule caught this)
- [x] Storefront PDP `generateMetadata`/JSON-LD wired with intelligent
      fallback to the existing generated defaults
- [x] Two real bugs found and fixed live: a `MedusaService` compile-time
      vs. runtime method-name mismatch (`tsc` was clean, the route still
      500'd), and a title-template collision (doubled "STIA" suffix) —
      both documented in `PROJECT_MEMORY.md` since they're the kind of
      thing likely to resurface in a future phase
- [x] Full round-trip verified live against the real Supabase database
- [ ] Structured Data Override has no form field in the widget yet (the
      model/storefront merge logic both work if set via the API directly)
      — small follow-up, not forgotten

**Phase B — Category SEO + Homepage SEO: done (2026-08-11).**
- [x] Shared `SeoForm` extracted from Phase A's product widget
      (`src/admin/components/seo-form.tsx`) instead of duplicating the form
      a second/third time
- [x] Category SEO admin widget (`product_category.details.side.after`
      zone)
- [x] Homepage SEO standalone admin route (`src/admin/routes/seo-homepage`)
      — homepage has no underlying Medusa entity, so no widget zone applies
- [x] Storefront category pages (`[category]`, `[category]/[subcategory]`)
      wired into `generateMetadata`, with a page-1-only canonical-override
      gate so paginated pages keep self-canonicalising
- [x] Storefront homepage `generateMetadata` added (didn't exist before —
      metadata came entirely from `RootLayout`'s static export)
- [x] Full round-trip verified live against the real Supabase database;
      `medusa lint`, `tsc`, full `next build`, full `medusa build` all clean

**Phase C — Site Settings: done (2026-08-11).**
- [x] New `site-settings` backend module (genuine singleton — first phase
      needing a new module rather than reusing Phase A's `seo` module,
      since a global object doesn't fit resource_type/resource_id)
- [x] Standalone admin route (`Ρυθμίσεις Καταστήματος`) — Announcement Bar,
      Footer tagline, Contact Details, Social Networks
- [x] Storefront: `AnnouncementBar` now admin-driven (renders nothing when
      empty, no more hardcoded placeholder copy), `Footer` gained a
      contact block + social icon row, both showing only populated fields
- [x] Full round-trip verified live against the real Supabase database;
      `medusa lint`, `tsc`, full `next build`, full `medusa build` all clean
- **Found and root-caused a real caching bug** (not a code bug): Next's
  on-disk fetch-cache (`.next/cache/fetch-cache/`) survives `next dev`
  restarts on this machine and can serve stale admin content past its
  `revalidate` window — see `CHANGELOG.md`/`PROJECT_MEMORY.md`'s Phase C
  entries for the full root-cause and the "check the database directly via
  curl before assuming application code is wrong" lesson

**Phase D — Content Pages: done (2026-08-11).**
- [x] New `content-pages` backend module — fixed six-slug set (About,
      Shipping, Returns, Privacy, Terms, FAQ), `is_published` defaults
      `false` so a page 404s until real content exists
- [x] Standalone admin route (`Σελίδες Περιεχομένου`) — client-side
      master/detail (list + form in one screen), not a nested `[id]`
      route, to sidestep a documented Medusa v2 admin dynamic-route-param
      bug (medusajs/medusa#9794)
- [x] Six storefront route folders (`/sxetika`, `/apostoles`,
      `/epistrofes`, `/aporrito`, `/oroi-xrisis`, `/faq`), plain-text
      paragraph rendering (no markdown, no raw HTML)
- [x] `sitemap.ts` includes each page only once it's published
- [x] Full round-trip verified live against the real Supabase database;
      `medusa lint`, `tsc`, full `next build`, full `medusa build` all clean

**Phase E — Homepage CMS: done (2026-08-11).**
- [x] New `homepage-blocks` backend module — single `kind: "hero"|"promo"`
      model, genuine create/delete (first open-ended list in this
      initiative, not just an upsert-by-key), typed `sort_order` instead
      of drag-and-drop
- [x] Admin route (`Αρχική Σελίδα`) — two client-side list sections,
      inline add/edit/delete, no nested `[id]` route (same
      medusajs/medusa#9794 avoidance as Phase D)
- [x] Storefront `Hero`: 0 slides → original default, 1 → static, 2+ → a
      real swipeable carousel reusing `ProductRail`'s native CSS
      scroll-snap pattern (no carousel library)
- [x] Storefront `EditorialBanner`: 1+ admin promo blocks in `sort_order`,
      falls back to the original hardcoded promo when none published
- [x] TrustStrip and Newsletter deliberately left out of scope (factual
      claims tied to real fulfillment capability; unwired signup form)
- [x] Full round-trip verified live against the real Supabase database;
      `medusa lint`, `tsc`, `next lint`, full `next build`, full `medusa
      build` all clean
- **Found and fixed a real bug live**: a blank field on a real admin
  slide rendered the *unrelated* default's copy instead of nothing, due to
  a per-field `??` fallback where a whole-object fallback was needed — see
  `CHANGELOG.md`/`PROJECT_MEMORY.md`'s Phase E entries for the fix and the
  general rule for any future admin-content component with the same
  zero/one/many shape

**Phase F — Product Merchandising: partially done (2026-08-11).**
- [x] New `product-extras` backend module — badge_label/badge_tone/
      warranty_text/downloads_url per product
- [x] Second admin widget (`Merchandising`) stacked in the product detail
      page's existing `product.details.side.after` zone alongside SEO
- [x] Storefront PDP: badge above the title, "Εγγύηση & Downloads" section
      (both render nothing when unset)
- [x] Full round-trip verified live against the real Supabase database;
      `medusa lint`, `tsc`, full `next build`, full `medusa build` all clean
- [ ] **Cross-sell curation — deferred**, needs a real product-picker UI
      (search-and-add, many-to-many), a genuinely bigger separate build.
      Automatic same-category cross-sell (`getRelatedProducts`) already
      exists and is unaffected.
- [ ] **Badge on grid listings (`ProductCard`) — deferred**, needs a batch
      `product-extras` endpoint (`?product_ids=a,b,c`) rather than N
      individual calls across every listing surface
      (`getFeaturedProducts`, category listings, search, etc.) — design
      that before extending `ProductCard`, not a small add-on

**Phase G — Cart/Checkout Marketing Config: done (2026-08-11).**
- [x] Extended the existing `site-settings` module with one `cart_message`
      field rather than a new module for a single text field
- [x] Admin: new "Καλάθι" section in the existing Ρυθμίσεις Καταστήματος
      page
- [x] Storefront: `CartDrawer` + `CartPageView` both show the message
      (prop-drilled from `RootLayout`/`kalathi/page.tsx`); checkout's
      order summary deliberately excluded (no-distraction principle)
- [x] Full round-trip verified live against the real Supabase database;
      `medusa lint`, `tsc`, full `next build`, full `medusa build` all clean
- **Deliberately did not re-enable `FreeShippingProgress`** — its own code
  comment gates the fix on "a real free-shipping rule/promotion on the
  backend," a shipping-engine change, not a content field. Still blocked
  on that, not reinterpreted into something this phase could ship.
- **Found a second instance of the Turbopack dev-server staleness
  gotcha** (corrupted `.next/dev/types/*` files this time, not stale
  fetch-cache) — see `CHANGELOG.md`/`PROJECT_MEMORY.md`'s Phase G entries.
  When a dev-server error contradicts a clean `next build`, delete
  `.next` before debugging further.

**Phase H — Search Management: mostly done (2026-08-11).**
- [x] `hide_from_search` + `is_search_boosted` booleans added to the
      existing `product-extras` module/Merchandising widget
- [x] New `search-synonyms` module + standalone `Αναζήτηση` admin route
      (same open-ended-list pattern as Phase E)
- [x] `lib/search.ts`: boosted matches promote to a new top `"boosted"`
      tier (not a blended score — respects the ranking's existing
      discrete-tier design); `rankSearchMatches` accepts multiple query
      variants for synonym expansion
- [x] New batch endpoint `/store/product-extras/search-overrides` (the
      search catalog needs every product's flags in one request)
- [x] Full round-trip verified live against the real Supabase database
      (synonym + boost + hidden-wins-over-boosted all confirmed); `medusa
      lint`, `tsc`, full `next build`, full `medusa build` all clean
- [ ] **Pinned (per-query product override) — deliberately not built**,
      a query→product mapping is a different mechanic from a product-level
      flag; boosted is the closest thing shipped, true pinning is a real,
      flagged gap

**Phase I — Media Library: done, deliberately scoped down (2026-08-11).**
- [x] New `media-assets` module — labeled external-URL list (`label`,
      `url`, `alt_text`), genuine CRUD, same open-ended-list pattern as
      Phase E/H
- [x] Admin route (`Βιβλιοθήκη Μέσων`) — client-side list, add/edit/delete
- [x] Full round-trip verified live against the real Supabase database;
      `medusa lint`, `tsc`, full `medusa build` all clean (no storefront
      changes this phase)
- **Real upload was explicitly not built** — this backend has no object
  storage configured (Medusa's default file provider is local-disk only,
  fine for the product admin's existing media upload but not something
  that survives a real deployment). Asked the user how to scope the phase
  before building anything; confirmed URL-based library over real upload.
  If a future session is asked to build real image upload, check for
  S3/object storage config in `medusa-config.ts` first — that's the real
  blocker, not missing UI.
- No `/store/media-assets` public route — nothing on the storefront reads
  this yet; a future image-picker integration into existing fields is a
  separate follow-up that would need one, not assumed here.

**Phase J — Campaigns: done, partially scoped down (2026-08-11).**
- [x] New `promo-banner` singleton module (headline/body/CTA/`ends_at`/
      `is_published`) — deliberately not named "campaign", which collides
      with Medusa's own native Promotions-module Campaign entity (a real
      error from `medusa db:generate`, not a guess)
- [x] Admin route (`Προωθητικό Banner`) — explicit that it creates no
      discount itself, points at Promotions for the real thing
- [x] Storefront `PromoBannerBar` — real live countdown, server-gated on
      `is_published` + not-expired, client re-checks every second so an
      already-open page hides an expiring banner without a reload
- [x] Full round-trip verified live against the real Supabase database
      (live countdown, forced expiry via direct API call, clean revert);
      `medusa lint`, `tsc`, full `next build`, full `medusa build` all clean
- **Newsletter popup deliberately not built** — blocked on the same real
  gap Phase E already found (the `Newsletter` component's signup form
  isn't wired to any real email provider); a popup version of a
  non-functional form would be worse than what exists, not better
- **Found and fixed a real hydration bug live**: computing the countdown's
  initial state with `Date.now()` during render caused a genuine
  server/client mismatch (confirmed in the console — server said one
  second, client said another). Fixed by starting state at `null` on
  every render and only setting the real value inside a `useEffect` — see
  `CHANGELOG.md`/`PROJECT_MEMORY.md` for the fix and the general rule for
  any future component computing something from `Date.now()`/
  `Math.random()` during render

**Phase K — Analytics/Consent: done (2026-08-11). Final phase of the
Admin-first platform roadmap.**
- [x] New `analytics-settings` singleton module — four nullable text
      fields (GA4 Measurement ID, GTM Container ID, Meta Pixel ID,
      Microsoft Clarity Project ID), none fabricated or pre-filled
- [x] Admin route (`Analytics`) — four plain text inputs, same
      load/save shape as every other singleton settings page
- [x] Real, functioning cookie-consent banner (`ConsentBanner`) — only
      renders if at least one service is configured and no choice is
      stored yet; Accept/Reject
- [x] Conditional script injection (`AnalyticsScripts`) — nothing loads
      until the visitor explicitly accepts; one independent `next/script`
      block per configured service; GTM's `<noscript>` fallback
      deliberately omitted (see `PROJECT_MEMORY.md` for why)
- [x] Full round-trip verified live against the real Supabase database —
      banner appears/absent correctly, scripts absent before accept,
      load after accept, rejection persists and loads nothing, no banner
      at all when nothing is configured; `medusa lint`, `eslint`, full
      `next build`, full `medusa build` all clean
- **This closes the Admin-first platform roadmap** — Phases A through K
  are all built, verified live, and committed.

**Admin-first platform: complete.** Phases A–K (Product SEO, Category/
Homepage SEO, Site Settings, Content Pages, Homepage CMS, Product
Merchandising, Cart/Checkout Marketing Config, Search Management, Media
Library, Campaigns, Analytics/Consent) are all built, verified live
against the real Supabase database, and committed. See `CHANGELOG.md`
for each phase's own entry.

**Admin-first platform post-implementation audit: done (2026-08-12).**
A full audit of the whole Admin-first platform surface plus its
storefront integration (Admin Dashboard, custom modules/workflows/
routes, storefront data flow, bugs, dead code, performance, SEO,
security) — the pre-existing catalog/cart/checkout code was explicitly
out of scope (already covered by the earlier "Full technical audit").
See `CHANGELOG.md`'s "Admin-first platform post-implementation audit"
entry for the full list.
- [x] Two real logic bugs fixed (promo-banner expiry fail-open on a bad
      date; content-pages create's spread-order bug that could bypass
      the slug-fallback title)
- [x] Missing input validation added to `media-assets`/`search-synonyms`
      (create+update) and `homepage-blocks` (update, to match its own
      create route)
- [x] `product-extras`' single-product store route trimmed to stop
      exposing internal search-tuning flags it doesn't need to
- [x] Every admin route's initial-load fetch now has real error handling
      (previously: none did, a failed load looked identical to "nothing
      saved yet")
- [x] Cross-page consistency fixes: Site Settings' Save button now
      matches its siblings, Homepage CMS gained a real empty state,
      Media/Search gained real `<Label>`s, every text field across all
      nine admin routes now has `htmlFor`/`id` linking, narrow-sidebar
      `grid-cols-2` layouts made responsive
- [x] `tsc`/`eslint`/`medusa lint` clean, full `next build` (19 routes)
      and full `medusa build` clean, before and after; backend fixes
      re-verified live via direct Admin API calls, admin UI fixes
      spot-checked live in the browser
- [ ] **Not fixed, flagged as a real but low-priority gap**: the three
      singleton modules (site-settings/promo-banner/analytics-settings)
      have no DB-level unique constraint backing their "exactly one row"
      invariant — a real race under concurrent writes, low likelihood
      for a single-admin tool, needs a new migration per module to close
- A seventh temporary admin user, `qa-agent6@stia.gr`, was created for
  this audit's verification — see the housekeeping list below (now 7
  qa-agent-pattern users to eventually delete, not 6).

## Next

This session's New Arrivals/infinite-scroll/carousels work (above) is
built and verified but has not had the user's own hands-on review — same
"ask, don't assume it's reviewed" pattern as every prior feature. Otherwise
genuinely open: see "Future" below (payment processor still on hold per the
user's explicit prior decision, account/content pages, housekeeping). Note
this section previously said Premium Checkout Phases 2-6 were "not
started" — stale; `git log` confirms all five checkout phases, the
card/wishlist/PDP work, and a search-dropdown/product-image/cart-polish
session all landed and were pushed before this session began.

## Future

**Phase 4 — Full product detail page**

- [ ] Real product gallery (multiple images, zoom) — **blocked**: needs real
      photography, which doesn't exist yet
- [x] Variant/option selection UI — **partially unblocked (Phase 5)**: a
      plain radio-group picker exists in `AddToCartButton` for any product
      with >1 variant, and grid cards route multi-variant products to the
      PDP instead of guessing. Still genuinely untested against real data —
      today's catalog remains 100% single-variant — so treat this as
      forward design, not verified UX, until a real multi-variant product
      exists to click through.
- [x] Related products — implemented as **same-category** cross-sell
      (`getRelatedProducts` in `lib/data/products.ts`), not literal "frequently
      bought together": there is no order history yet, so a real co-purchase
      signal doesn't exist. Labeling it "bought together" would have been the
      same class of fabricated trust signal as the fake 4.6-star ratings this
      project already treated as a bug (see `PROJECT_MEMORY.md` UX decisions).
      Revisit once real order data exists to compute genuine co-purchase pairs.
- [ ] Reviews + Q&A — **blocked**: needs a review system, which doesn't exist
- [x] Recently viewed — client-side (`localStorage`, capped at 8, most-recent
      first), resolved to real product data via a Server Action
      (`lib/actions/recently-viewed.ts`) since the handles are only known in
      the browser. See `RecentlyViewedTracker`/`RecentlyViewed` components.

**Phase 5+ — Checkout follow-ups** — superseded by the Premium Greek
Checkout initiative, see `CHECKOUT_PREMIUM_SPEC.md` and the Phase 1 entry
above for the current, real plan:

- [x] Store Pickup — **done**, see "Completed" above.
- [ ] BOX NOW locker delivery — deferred (needs a real BOX NOW
      merchant/partner relationship, not self-serve; architecture kept
      extensible so it's additive once access exists)
- [x] Billing address toggle + receipt/invoice toggle + ΑΦΜ checksum
      validation — **done**, see "Completed" above.
- [x] Address autocomplete — **built**, see "Completed" above. Not yet
      verified against a real Google API key.
- [x] ΑΦΜ/business lookup — **built**, see "Completed" above. Not yet
      verified against a real approved ΓΕΜΗ key.
- [x] Order confirmation emails — **built**, see "Completed" above (SendGrid,
      not Resend). Not yet verified against a real SendGrid API key.
- [ ] A real payment processor — **Stripe first** (decided), official
      Medusa plugin, covers cards + Apple Pay + Google Pay; Viva
      Wallet/IRIS documented as a later option, needs a custom payment
      provider module (Phase 6). Needs real (test-mode) Stripe credentials
      from the user before the integration step.
- [ ] Reconcile `TrustStrip.tsx` (homepage) and the PDP's delivery-info
      block — both still say "Κάρτα, Viva Wallet ή αντικαταβολή," which
      overclaims relative to what checkout can actually offer today; becomes
      true once Stripe ships (Phase 6)
- [ ] Customer accounts + cart/wishlist sync for logged-in customers —
      explicitly confirmed out of scope for this initiative; scope
      separately later

**Phase 6+ — Account, wishlist, content pages**

- [x] Search — **done (Phase 5)**: header live-dropdown + `/anazitisi`
      results page, backed by Medusa's own `q` search (title + SKU
      together). No fuzzy/typo-tolerant matching (Postgres `ILIKE`-style,
      not a real search engine) — acceptable at today's catalog size,
      revisit only if the catalog grows substantially.
- [x] Wishlist — **done**: `localStorage`-backed, real `/lista-epithymion`
      page, header count badge. See "Completed" above.
- [ ] Wishlist header icon on true mobile widths (`hidden sm:block`, same
      as the account icon) — the heart-toggle interaction works everywhere
      on mobile already, this is specifically the header nav entry point;
      needs a `MobileMenu` change.
- [ ] Account area (`/logariasmos` — real page, currently 404)
- [ ] About/legal/help content pages (footer links to these — real pages,
      currently 404; low priority, no business logic involved)
- [x] Backend hosting decision — **Railway** (Supabase Postgres stays as-is,
      no Redis needed). Deployment config prepared and committed
      (`apps/backend/railway.json`, `DEPLOYMENT.md`) 2026-08-12; actual
      Railway/Vercel account creation and env var entry still needs the
      user (can't be done without account access) — see `DEPLOYMENT.md`
      "Manual steps."
- [ ] Real material/weight/dimensions/origin-country data entry for the 16
      real products, in the Medusa admin — the PDP's Characteristics
      section is fully built and will render automatically the moment this
      data exists; today it renders nothing (correct, not a bug)

**Found by the production readiness audit, deliberately not fixed**

- [ ] **The newsletter form silently does nothing** — validates, then
      `preventDefault()`s with no feedback and no stored address. Needs a
      real email-provider decision (or, as an interim, honest copy saying
      signups aren't open yet); not something to invent plumbing for.
- [ ] **`PaymentSection`'s multi-provider UI is structurally broken** — N
      always-`checked` `readOnly` radios with no selection state, and
      `completeCheckoutAction` uses `providers[0]` regardless. Harmless with
      exactly one provider; build it properly alongside the first real
      payment processor, not speculatively.
- [ ] **Favicon is still Next.js's own default logo** (`public/` is empty).
      Blocked on the same missing brand asset as `Organization.logo`.
- [ ] **Content-Security-Policy** — baseline headers are in place, but a
      real CSP needs per-request nonces threaded through the inline JSON-LD
      `<script>` tags. Its own change, not a header-list tweak.

**Found by the 2026-08-12 full technical audit, deliberately not fixed**

- [ ] **`CheckoutForm.handleInvoiceFieldBlur` has a latent stale-closure
      race** — sets `currentFields` from inside a `setInvoiceFields`
      updater and validates/saves it on the next line; a preceding
      `setAfmLookupLoading(false)` likely defers the updater, so the
      "save immediately after a ΓΕΜΗ autofill" path uses pre-lookup data.
      Unreachable today (`GEMI_API_KEY` unset, autofill branch never
      runs). Every fix considered reintroduces the exact typing-during-
      `await` race this pattern was built to prevent — needs a real
      decision once ΓΕΜΗ is actually wired up (Phase 4.3), not a blind
      patch now.
- [ ] **Multiple `<h1>`s on the homepage if a second hero slide is ever
      published** — `HeroSlide` renders one per slide, `HeroCarousel`
      renders one `HeroSlide` per slide. Latent only: exactly one slide
      renders today. Fix is a design decision (which heading demotes to
      `h2`), not a bug patch.
- [ ] **`completeCheckoutAction` may create a duplicate payment collection
      on a retry after a failed completion** — unverified either way; no
      failure-capable payment provider exists yet to force the retry path.
- [ ] **Two near-identical hand-rolled focus traps** (`MobileMenu`,
      `CartDrawer`, ~30 lines each, subtly different focusable selectors).
      A shared `useFocusTrap` hook is the obvious dedupe, but both traps are
      verified working and the payoff is small — left alone on purpose.
- [ ] **`ProductCard` is a Client Component in full** — the whole card
      (image, title, price, badges) hydrates so the quick-add button can be
      interactive. Splitting it into a server card + a client button island
      would cut hydration work on every grid, but it touches the one shared
      card component whose class list is explicitly protected; worth doing
      deliberately rather than as audit collateral.
- [ ] **`TrustStrip`'s "Δωρεάν επιστροφές 30 ημερών"** is an unbacked
      business-policy claim (no returns policy page exists, and EU law
      mandates 14 days, not 30). Not changed — it needs a business
      decision, not a code fix.

**Housekeeping / non-blocking, any time**

- [ ] Rotate `JWT_SECRET`/`COOKIE_SECRET` again before any real deployment
      (currently locally-generated random values, fine for dev only)
- [ ] Decide on a real brand name/domain before any of this is public-facing
- [ ] Real product photography to replace `PlaceholderTile` everywhere
      (unblocks two Phase 4 items above)
- [ ] Re-run responsive verification (375/768/815/1280px) now that real data/
      real product counts exist — last full pass was Phase 1, before real data
- [ ] Run an actual Lighthouse/axe pass — nothing has been run yet, only manual
      review
- [ ] Delete the temporary `qa-agent`-pattern admin users — `test-agent@
      stia.gr`, `qa-agent@stia.gr`, `qa-agent2@stia.gr`, `qa-agent3@stia.gr`,
      `qa-agent4@stia.gr`, `qa-agent5@stia.gr`, `qa-agent6@stia.gr`
      (created one per session as needed to drive the Admin API directly
      for verification, Phase 4A through the Admin-first platform
      post-implementation audit — all harmless but unnecessary; see
      `PROJECT_MEMORY.md` for which phase created each one)
- [ ] Decide the real free-shipping threshold and set
      `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD_EUR` accordingly (currently a €50
      placeholder default), then flip `FREE_SHIPPING_MESSAGE_ENABLED` back
      on in `FreeShippingProgress.tsx` once a real backend rule exists
- [ ] Two real test orders exist in the local dev database from checkout
      verification (`display_id` 1 and 2) — harmless (local dev only), no
      cleanup endpoint used deliberately (cancelling/deleting real orders
      isn't something to do casually); fine to ignore or clear manually via
      the admin later
