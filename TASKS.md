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

## Next

Checkout is built, verified, and stable — but per the user's own
instructions for this phase, it doesn't move to the next phase until they've
had a chance to review it themselves. See `NEXT_STEPS.md`.

## Future

**Phase 4 — Full product detail page**

- [ ] Real product gallery (multiple images, zoom) — **blocked**: needs real
      photography, which doesn't exist yet
- [ ] Variant/option selection UI — **blocked**: today's catalog is 100%
      single-variant, there's nothing to select and no way to test a selector
      against real data
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

**Phase 5+ — Checkout follow-ups** (the checkout itself is done — see
"Completed" above)

- [ ] ΑΦΜ/ΔΟΥ + receipt-vs-invoice choice — not in the approved checkout
      spec's scope (business hasn't decided if/how it wants this yet);
      revisit if needed
- [ ] A real payment processor (Viva Wallet, Stripe, etc.) — today's
      checkout only has Medusa's manual provider, presented honestly as
      "Αντικαταβολή." Adding a real one is a data/config change on the
      backend, not a storefront redesign (the payment UI already reads its
      options live, not hardcoded)
- [ ] Reconcile `TrustStrip.tsx` (homepage) and the PDP's delivery-info
      block — both still say "Κάρτα, Viva Wallet ή αντικαταβολή," which
      overclaims relative to what checkout can actually offer today

**Phase 6+ — Search, account, wishlist, content pages**

- [ ] Predictive search (header search input is currently a plain text field
      with no backend)
- [ ] Account area, wishlist (header icons link to `/logariasmos`,
      `/lista-epithymion` — real pages, currently 404)
- [ ] About/legal/help content pages (footer links to these — real pages,
      currently 404; low priority, no business logic involved)
- [ ] Backend hosting decision (Vercel can't run Medusa's persistent server —
      deferred until actually needed, per explicit prior user decision)

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
- [ ] Delete the `test-agent@stia.gr` admin user (created during Phase 4A API
      verification, harmless but unnecessary — see `PROJECT_MEMORY.md`)
- [ ] Decide the real free-shipping threshold and set
      `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD_EUR` accordingly (currently a €50
      placeholder default), then flip `FREE_SHIPPING_MESSAGE_ENABLED` back
      on in `FreeShippingProgress.tsx` once a real backend rule exists
- [ ] Two real test orders exist in the local dev database from checkout
      verification (`display_id` 1 and 2) — harmless (local dev only), no
      cleanup endpoint used deliberately (cancelling/deleting real orders
      isn't something to do casually); fine to ignore or clear manually via
      the admin later
