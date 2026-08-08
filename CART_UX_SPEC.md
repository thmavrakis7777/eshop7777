# Cart UX Specification — Phase 4A

Status: **Approved and implemented (2026-08-08).** Written in response to an
explicit design brief requesting a full research + design pass before any
cart code was touched; approved by the user, then built and verified against
the live Medusa backend — see `CHANGELOG.md` for the implementation entry and
`CURRENT_STATE.md` for what was tested. This file remains the design
reference for *why* things are built the way they are; treat deviations
found later as either a bug to fix or a deliberate update to make here, not
silently drift from.

Research note on grounding: this spec is grounded in (a) a live inspection of
`public.gr`'s cart-adjacent PDP UI (bundle upsell widget, discount/price
display, review-count pattern) done during this session, and (b) well-
established, widely-published ecommerce cart/checkout usability research
(the general body of findings usually associated with the Baymard Institute's
cart/checkout studies — abandoned-cart causes, quantity-control conventions,
coupon-field placement effects). Two other live sites (`zarahome.com`,
`ikea.com`) were attempted and blocked by this environment's browsing
controls, so no specific claims are made about their current UI — every
recommendation below is either sourced from the `public.gr` check or stated
as a general pattern, not attributed to an unverified competitor.

---

## 0. Decisions that need your explicit input before implementation

These aren't fully my call — flagging them up front rather than burying them
in section 18:

1. **Free-shipping threshold amount** — the brief says "don't hardcode," and
   I'm not hardcoding it (see §9), but *someone* eventually sets the number.
   Not needed to start building — a placeholder + config point is enough for
   now.
2. **Coupon codes**: does the business plan to actually run coupon campaigns
   at launch, or is this pure future-proofing? Medusa v2 supports promotions
   natively (`/store/carts/:id/promotions`), so this is cheap to build either
   way, but it changes how much polish the coupon section deserves at v1.
3. **Remove-line-item control**: I'm recommending a text link ("Αφαίρεση")
   rather than an icon-only ✕ button, for discoverability/accessibility
   (§8). An icon button is more compact if you'd rather optimize density.
4. **Cross-sell in the full cart page** (§10): I'm recommending the same
   honest "same-category" signal already used for PDP related products
   (`PROJECT_MEMORY.md` UX decisions), not a fabricated "customers also
   bought" claim — consistent with this project's stance, but flagging it
   since it's a deliberately smaller feature than a true bundle engine.

---

## 1. Overall design concept

**"Confident restraint."** The cart should feel like the calmest part of the
site, not the most decorated. Everything else about STIA's design system
(`PROJECT_MEMORY.md` → Design system) already committed to this: white
background, one accent color, no gradients, 150–200ms motion only. The cart
inherits all of it exactly — it does not get its own visual language. The
only new UI vocabulary introduced is functional, not decorative: a quantity
stepper, a progress bar, a coupon toggle.

Two surfaces, one data source:

- **Drawer (mini-cart)** — fast, in-context editing without leaving the page
  you're on. Opened deliberately (never forced open by an add-to-cart).
- **Full cart page** (`/kalathi`, already linked from the header today) —
  the "I'm about to go to checkout, let me look at everything" moment. More
  breathing room, includes the cross-sell rail the drawer intentionally
  omits.

Both render the same line-item row component against the same cart data, so
there is never a discrepancy between what the drawer shows and what the page
shows.

**Why two surfaces instead of one:** collapsing them into one component
doing both jobs is exactly the mistake this project already made once and
fixed — see `PROJECT_MEMORY.md`'s note on the mega menu vs. mobile drawer:
"the interaction models are different enough... that sharing one component
was making both worse." A drawer optimizes for staying on the current page;
a full page optimizes for a focused, distraction-light review before
checkout. Different jobs, different layouts.

## 2. Add-to-cart confirmation (not a forced drawer open)

**Behavior**: clicking any "add to cart" control (PDP's `AddToCartButton`,
`ProductCard`'s quick-add) does **not** open the drawer. It:

1. Immediately updates the header cart badge count (optimistic, then
   reconciled against the real Medusa response).
2. Shows a small, self-dismissing confirmation: **"Προστέθηκε στο καλάθι"**
   with a **"Προβολή καλαθιού"** action that opens the drawer if clicked.
3. Auto-dismisses after ~4s if ignored. Never blocks further interaction
   with the page underneath it.

**Placement:**
- **Desktop**: a small toast anchored under the header, right-aligned above
  the cart icon — visually "docks" to where the item just went.
- **Mobile**: a toast anchored to the bottom of the viewport, above any
  safe-area inset — the header/cart icon is frequently scrolled out of view
  on mobile PDPs, so anchoring to the top would often be invisible; the
  bottom is also where a thumb already is.

**Why not open the drawer on every add:** the brief already states this
requirement, and it matches the more general finding that forcing a drawer
open on every add-to-cart is most jarring in exactly the flow this catalog
supports well — a category grid where someone quick-adds two or three
products in a row (`ProductCard`'s hover "+ Καλάθι" button already exists
for this). A forced drawer after each click would interrupt that browsing
rhythm three times in ten seconds. An unobtrusive confirmation respects
intent: the customer asked to add an item, not to review their cart.

## 3. Desktop cart drawer

- Slides in from the right, fixed width ~420–480px, full viewport height,
  backdrop dim behind it (click-outside closes).
- Reuses the exact focus-trap/Escape-to-close/focus-return pattern already
  built and verified for `MobileMenu` (`PROJECT_MEMORY.md` flags this as a
  real, previously-fixed accessibility bug — not reinventing it here).
- Header: **"Το καλάθι σου (N)"** + close (✕), `aria-label="Κλείσιμο
  καλαθιού"`.
- Scrollable line-item list (component shared with the full cart page, §8).
- Sticky footer (does not scroll with line items): free-shipping progress
  (§9) → subtotal → collapsed coupon toggle (§7) → primary checkout CTA
  (§13) → secondary "Δες το καλάθι" link to `/kalathi`.
- No cross-sell rail in the drawer — kept intentionally lean and fast; the
  full page is where that lives (§10).

## 4. Mobile cart drawer

- **Full-screen**, not a partial-width side sheet — at 320–414px a
  right-anchored drawer that's only 80% of the viewport wastes the one
  resource mobile doesn't have (width) and leaves an oddly-clipped visible
  strip of the page behind it.
- Slides in as a full-screen overlay (from the right or bottom — recommend
  right, consistent direction with the desktop drawer and with
  `MobileMenu`'s existing pattern).
- Same content and order as desktop, stacked with generous vertical rhythm.
- Quantity stepper buttons and remove control sized to a minimum 44×44px
  touch target (WCAG 2.5.5 / Apple & Material guidance).
- Checkout CTA is sticky-pinned to the bottom, above `env(safe-area-inset-
  bottom)`, so it's reachable one-handed without scrolling and never hidden
  behind a device's home-indicator area.

## 5. Full cart page (`/kalathi`)

- **Desktop** (≥1024px): two columns — line items (~65% width, left) and an
  order summary card (~35%, right, `sticky` on scroll) containing subtotal,
  free-shipping progress, coupon toggle, and the checkout CTA. This is the
  same footer content as the drawer, just given more room.
- **Mobile**: single column — line items, then the order summary card
  in-flow directly beneath them (not artificially pinned, since the page is
  meant to be read top-to-bottom, unlike the drawer which is a quick-access
  panel).
- Below the line items (desktop) or below the summary card (mobile): the
  cross-sell rail (§10), using the existing `ProductRail` component for
  visual consistency with the rest of the site.
- Empty state replaces the whole page content (§6).

## 6. Empty cart

- Centered, single column, generous whitespace — explicitly **not** styled
  like an error (no red, no warning triangle, no `role="alert"` tone).
- Simple line-icon (matches the existing `Icons.tsx` set's style — no new
  illustration system introduced for one screen).
- Headline: **"Το καλάθι σου είναι άδειο."** One short supportive line
  beneath it (e.g. "Βρες κάτι που θα αγαπήσεις για το σπίτι σου.").
- Primary CTA: **"Συνέχεια αγορών"** → homepage.
- If `localStorage` has recently-viewed handles (it already does, from the
  Phase 4 work just shipped), render the existing `RecentlyViewed` component
  beneath the empty-state message — free reuse of a component that already
  exists, and turns an empty cart into a soft re-entry point instead of a
  dead end.

## 7. Coupon section

- **Collapsed by default** behind a plain text toggle: **"Έχεις κωδικό
  έκπτωσης;"** — expands to reveal an input + **"Εφαρμογή"** button. This is
  the brief's explicit requirement ("do not make coupon entry visually
  dominant over the checkout CTA") — a permanently-open input field with its
  own "Apply" button reads as equally important as the checkout button;
  collapsing it behind a low-emphasis toggle fixes that without hiding the
  feature.
- **States**:
  - *Default*: toggle only.
  - *Expanded, empty*: input + disabled "Εφαρμογή" until text is entered.
  - *Applying*: button shows a spinner, input disabled, no page-level
    loading blocker.
  - *Success*: input replaced by a compact chip showing the code + the
    discount it produced (e.g. "ΚΑΛΟΚΑΙΡΙ10 · −4,50€") + a small
    **"Αφαίρεση"** text action. The discount appears as its own line in the
    price breakdown (Υποσύνολο → Έκπτωση κωδικού → Σύνολο).
  - *Invalid*: inline message under the input, **"Ο κωδικός δεν είναι
    έγκυρος."**, input stays editable, no page reload. Uses the design
    system's existing `--color-danger` (`#b3261e`, `globals.css`) — no new
    semantic color needed, it's already defined and just currently unused.
  - *Expired*: **"Ο κωδικός έχει λήξει."** (same `--color-danger` treatment)
  - *Already applied / not applicable to cart contents*: Medusa's promotion
    validation errors get mapped to plain Greek, never surfaced raw (see §14
    for the general rule).
- Medusa v2 has a native Promotion module (`/store/carts/:id/promotions`)
  for this — **verify the exact request/response shape against the live
  Store API before implementing**, per this project's established rule
  (`PROJECT_MEMORY.md` → Development rules) rather than assuming.

## 8. Product row (line item)

Shared component, used identically in the drawer and the full page (only
surrounding density/spacing differs).

Anatomy, left to right (desktop) / stacked (narrow mobile):

- Thumbnail (`PlaceholderTile` today, real `next/image` once photography
  exists — no cart-specific change needed later, it inherits whatever the
  PDP/PLP switch to).
- Title (links to the PDP) + variant/options line — **conditionally
  rendered**: today's catalog is 100% single-variant (`PROJECT_MEMORY.md`),
  so this line simply doesn't render yet. Building it as "hidden unless
  variant data exists" now means the row component doesn't need to change
  shape once real variants exist later.
- Unit price block: reuses the exact price-block pattern already on the PDP
  (`page.tsx` lines ~81–86) — bold current price, muted strikethrough
  compare-at price, small accent "-X%" chip when on sale. Reusing this
  exact pattern (not inventing a cart-specific one) keeps the PDP → cart
  price presentation visually identical, which matters for trust (the price
  someone remembers from the PDP is the price they see in the cart).
- Quantity stepper (§9, described separately since it has its own states).
- Line total (unit price × quantity).
- **Remove**: a text link, "Αφαίρεση" (see open question in §0.3 — icon-only
  is the denser alternative but text is the safer accessible default and
  what I'd ship absent other direction).
- Stock/availability microcopy: **only rendered when it matters** — nothing
  shown for normal availability (avoids noise, matches the project's
  "don't fabricate/don't over-signal" ethos), a quiet note when stock is low
  ("Μόνο 3 διαθέσιμα"), and a clear flagged state when unavailable (§14).

## 9. Discounted line-item state

Already covered by reusing the PDP's existing price-block pattern in §8 —
deliberately not a new design. The discounted price is always the visually
dominant one (larger, bolder, ink-colored); the original price is always the
smaller, muted, struck-through one; the percentage-off chip is the smallest
element of the three. This ordering (current price → original price → %
badge, by visual weight) is what keeps the pricing unambiguous per the
brief's explicit requirement.

## 10. Quantity controls

- Stepper: `−` / numeric value / `+`, inline in the row, usable directly in
  the drawer (the brief is explicit: no forcing a trip to the full cart page
  just to change a quantity).
- `−` is **disabled, not decrement-past-1** at quantity 1 — going to 0 via
  the minus button would silently remove the item, which is a bigger,
  easily-mis-tapped action than adjusting quantity. Removal is a deliberate,
  separate control (the "Αφαίρεση" link, §8).
- `+` was originally planned to disable once the line quantity reaches
  available stock. **Implementation note (2026-08-08):** the Store API
  doesn't expose per-variant stock counts in this setup, so there's no
  ceiling to proactively disable at — `+` stays enabled and the real
  Medusa-enforced limit (confirmed live: it does reject overflow server-side)
  surfaces reactively as the row-level error from §14 if actually hit.
- Updates are **optimistic**: the UI reflects the new quantity and
  recalculated line/subtotal total immediately, while the real Medusa
  update happens in the background (React's `useOptimistic` + a Server
  Action, no new state-management dependency — see §17). If the server
  rejects it (e.g., someone else bought the last unit), the row reconciles
  to the real state and shows the relevant stock message — never a raw
  error.

## 11. Free-shipping progress

- Thin progress bar + one line of copy, positioned above the subtotal in
  both the drawer footer and the full-page summary card.
- Below threshold: **"Ακόμα {amount} για ΔΩΡΕΑΝ μεταφορικά"** — bar fills
  proportionally to `subtotal / threshold`, accent-colored.
- At/above threshold: **"Έχεις ΔΩΡΕΑΝ μεταφορικά 🎉"** — bar shows full,
  single emoji only (matches the brand's "zero clutter" restraint — one
  celebratory beat, not a confetti moment).
- **Threshold is a config value, not a hardcoded number** — a single
  exported constant (e.g. `lib/cart-config.ts` → `FREE_SHIPPING_THRESHOLD`),
  documented as a placeholder pending a real business decision (§0.1).
  Ideally this mirrors a real Medusa shipping-option condition rather than
  living only in frontend config — **needs verification against the live
  Store API for whether Medusa's conditional/conditional-free shipping
  options expose a threshold the frontend can read**, rather than assuming;
  if not, the frontend constant is the source of truth and must be kept in
  sync with whatever shipping-option logic actually applies at checkout.
- The whole bar is **omitted entirely**, not shown at zero progress oddly,
  when the cart is empty (nothing to make progress toward yet).

## 12. Cross-sell / AOV

- Lives **only** on the full cart page (§5), never in the drawer — keeps the
  drawer fast and focused on what's already in the cart, and matches the
  brief's instruction to avoid aggressive upselling.
- Heading: **"Ταιριάζει καλά με ό,τι έχεις στο καλάθι"** ("pairs well with
  what's in your cart").
- **Signal used**: same-category products relative to what's in the cart,
  excluding items already present — the same honest, real signal already
  used for PDP related products (`getRelatedProducts`), not a fabricated
  "customers who bought this also bought" claim (no order history exists to
  back that yet — see `PROJECT_MEMORY.md` UX decisions and this project's
  established precedent on the topic).
- Capped at 3–4 suggestions, rendered via the existing `ProductRail`
  component — no new visual pattern.
- A future upgrade path exists without a rebuild: if the business later
  wants true curated pairings (pan → spatula, pot → lid), that's a
  `product.metadata` tag Medusa's admin can set and a small change to the
  query — doesn't require touching the row/rail components.

## 13. Checkout CTA

- Full-width button, reuses the existing `AddToCartButton`'s visual
  treatment (`bg-ink` → `hover:bg-accent`, same radius/padding scale) for
  consistency with the PDP's primary action.
- Label: **"Ολοκλήρωση παραγγελίας"**, with the subtotal restated directly
  above or inside it for confidence at the moment of commitment.
- Sticky at the bottom of the drawer/mobile viewport; in the desktop full
  page it lives at the top of the sticky summary card.
- **Disabled** (with a short inline reason, not just a dead button) when:
  the cart is empty, or contains a line item that's gone out of stock and
  hasn't been resolved yet (§14). Never silently allow proceeding to
  checkout with a blocking problem still in the cart.

## 14. Error states (all Greek, short, human, no technical leakage)

| Scenario | User-facing copy | Behavior |
|---|---|---|
| Product/variant no longer available | "Αυτό το προϊόν δεν είναι πλέον διαθέσιμο." | Row flagged, checkout blocked until removed |
| Quantity exceeds available stock | "Δεν υπάρχει αρκετό απόθεμα για αυτή την ποσότητα." (revised during implementation — see note below) | Update rejected, quantity reverts to last valid value |
| Coupon invalid | "Ο κωδικός δεν είναι έγκυρος." | Input stays editable |
| Coupon expired | "Ο κωδικός έχει λήξει." | Input stays editable |
| Coupon removed | (no error — just reverts to the collapsed toggle state) | — |
| Price changed since added | "Η τιμή ενημερώθηκε." (shows new price) | Non-blocking, informational |
| Cart/session expired | "Το καλάθι σου έληξε. Ξεκίνα ένα νέο." | Fresh empty cart, no alarming tone |
| Network error | "Κάτι πήγε στραβά. Δοκίμασε ξανά." | Retry action offered |
| Medusa API error (5xx) | Same generic message as network error | Details logged server-side only, never shown |
| Product deleted | Same as "no longer available" | Row flagged/removable |

General rule: **no raw fetch/HTTP/stack-trace text ever reaches the
customer** — every failure path maps to one of the rows above or a generic
fallback, matching the "never fabricate, never expose internals" posture
already established for this project.

**Implementation note (2026-08-08):** the "quantity exceeds stock" copy
above was revised from the original draft's "Διαθέσιμα μόνο {n} τεμάχια."
once live API verification showed Medusa's `insufficient_inventory` error
doesn't include the actual remaining count, and the Store API doesn't expose
per-variant stock on the products endpoint at all in this setup — showing a
specific number would have meant fabricating one. The revised copy is
honestly vaguer but doesn't claim a fact the app doesn't have.

## 15. Loading states

- Initial cart fetch (drawer open, or page load): skeleton rows in the same
  shape as the real line-item row (matches `PlaceholderTile`'s existing
  visual language — a muted block, not a generic spinner).
- Per-action loading (quantity change, coupon apply, remove): scoped to that
  control only (inline spinner / disabled state) — the rest of the cart
  stays interactive. No full-page or full-drawer blocking overlay for a
  single line-item action, per the brief's performance requirement.

## 16. Success states

- Add-to-cart confirmation (§2).
- Coupon applied (§7).
- Quantity/removal updates simply resolve to their new state — no separate
  "saved!" toast, since the updated number/total *is* the confirmation.
  Adding a redundant success message on top of a visibly-updated total would
  be exactly the kind of unnecessary UI weight the brief asks to avoid.

## 17. Stock states

- **In stock**: no message (default, silence is correct here — matches the
  project's existing "don't show a signal unless it's meaningfully true"
  stance).
- **Low stock**: quiet inline note, only under a real threshold (e.g. ≤5
  units) — "Μόνο {n} διαθέσιμα."
- **Out of stock**: clearly flagged line, checkout blocked until resolved
  (§13/§14).

## 18. Medusa architecture (source of truth, no parallel cart system)

- Medusa v2's Cart module owns everything: cart, line items, prices,
  applied promotions, region, totals. The frontend never computes prices or
  discounts itself — it only renders what `/store/carts/:id` returns.
- **Persistence**: a `cart_id` stored in a cookie (not `localStorage`) —
  this is Medusa's own conventional pattern, survives refresh, and (unlike
  `localStorage`) is readable from Server Components/Server Actions via
  `next/headers` `cookies()`, which keeps cart mutations symmetric with how
  this project already reads recently-viewed data server-side (§ recently-
  viewed Server Action, just shipped in Phase 4).
- **Mutations as Server Actions** (`lib/actions/cart.ts`, following the
  `lib/actions/recently-viewed.ts` pattern already established this
  session): add line item, update quantity, remove line item, apply/remove
  promotion. Each action calls `revalidatePath`/`revalidateTag` so the
  header's cart count and the full cart page (both Server Components) stay
  correct without introducing client-side global state. Client components
  (the drawer, quantity steppers) layer `useOptimistic` on top for instant
  visual feedback — no Redux/Zustand/Context-heavy state library needed,
  matching the brief's "no large dependencies" performance requirement and
  this project's existing "no global state library" stance
  (`PROJECT_MEMORY.md` → Frameworks).
- **Account linkage, deferred but not blocked**: Medusa carts support an
  optional `customer_id`. Nothing about this design requires building it
  now — once an account system exists, the only change needed is
  associating the existing guest cart to the logged-in customer at login
  time (Medusa's standard "transfer cart" flow). No rebuild of the cart
  itself.
- **Before writing any cart code**: verify the exact Store API request/
  response shapes for cart creation, line-item add/update/remove, and
  promotions against the live backend — this project has twice already
  caught real bugs (missing `currency_code` param, category-descendant
  filtering) by doing exactly this instead of assuming API shape from
  memory or generic Medusa docs.

## 19. Add-to-cart → cart → checkout user flow

**Desktop:**
1. Browsing a PLP or PDP → click "add to cart" (quick-add or PDP button).
2. Toast confirms near the header cart icon; badge count updates; user stays
   on the same page.
3. User either keeps browsing (most common), or clicks the toast's "Προβολή
   καλαθιού" / the header cart icon → drawer slides in.
4. In the drawer: adjust quantities, remove items, optionally apply a
   coupon, watch the free-shipping bar.
5. Either close the drawer and keep shopping, or click "Ολοκλήρωση
   παραγγελίας" (from the drawer) or "Δες το καλάθι" → full `/kalathi` page
   for a final look (including the cross-sell rail) before checkout.

**Mobile:**
1. Same add-to-cart trigger; confirmation toast anchored to the bottom
   (thumb zone) instead of the header.
2. Tapping "Προβολή καλαθιού" or the header cart icon opens the full-screen
   drawer (not a partial sheet, §4).
3. Same edit capabilities as desktop, laid out for one-handed scrolling,
   sticky checkout CTA always reachable without scrolling further.
4. "Δες το καλάθι" leads to the same full cart page as desktop, single-
   column.

## 20. Accessibility & performance summary

- Keyboard: full tab order through the drawer/page, quantity steppers and
  remove links reachable and operable via keyboard alone, checkout CTA
  reachable last.
- Focus management: reuses `MobileMenu`'s already-verified pattern (initial
  focus on open, Tab trap inside the drawer, Escape closes, focus returns to
  the trigger element on close).
- ARIA: drawer is a proper dialog (`role="dialog"`, `aria-modal="true"`,
  labelled by its "Το καλάθι σου" heading), quantity inputs have accessible
  labels tied to the product name ("Ποσότητα για {title}"), error/status
  messages use `aria-live="polite"` regions so screen-reader users hear
  stock/coupon/price-change updates without a full re-announcement of the
  cart.
- Performance: cart reads are Server-Component-fetched where possible
  (full page, initial drawer state), mutations are Server Actions with
  optimistic client updates — no polling, no unnecessary re-fetching of the
  whole cart on every keystroke/click, no new heavy client dependency.

---

## What happens after approval

Per the brief: once this spec is approved, the next step is a short written
implementation plan (component list, new files, Server Action list, the
specific Medusa endpoints to verify first), then building it incrementally,
then the full verification pass the brief specifies (real backend, desktop,
mobile, empty cart, multiple products, quantity changes, discounts, coupons,
stock limits, persistence, errors, loading states, accessibility,
performance, plus `tsc`/`eslint`/`next build`), then updating
`PROJECT_MEMORY.md`/`TASKS.md`/`CHANGELOG.md`. Checkout itself stays out of
scope until the cart is fully built, tested, and approved.
