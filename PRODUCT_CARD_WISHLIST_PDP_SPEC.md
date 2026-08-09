# Spec: Product Card Redesign, Wishlist, Stock Display, PDP Content

Status: **proposed, not yet approved**. Written after inspecting the current
`ProductCard`/PDP implementation and the live Medusa Store API (confirmed
against the real 16-product catalog), plus a short look at how established
Greek home-goods retailers (Spitishop and peers) structure product cards and
detail pages — for UX-pattern reference only. Nothing here reproduces their
copy, layout code, or visual design; the recommendations below are STIA's
own, reasoned from this codebase and standard, brand-neutral ecommerce
conventions (heart icon on the image corner, stock line near the CTA, a
specs table on the PDP — patterns common across the category, not any one
competitor's design).

## 0. What's already true (so nothing below duplicates it)

- `ProductCard` is still the single shared card component on every product
  grid (home, category/subcategory, PDP related/recently-viewed, cart
  cross-sell, search results) — confirmed unchanged since Phase 5.
- Stock-awareness already exists: `Product.isAvailable` /
  `ProductVariant.isAvailable`, computed once in `lib/data/products.ts` from
  real Medusa inventory fields, already gates the Add to Cart button and
  shows an `Εξαντλήθηκε` badge. Feature 3 below is a *display* change
  (make the positive state visible too, not just the negative one), not a
  new data source.
- Product code (SKU) already exists as `product.code`, shown on the PDP.
- **Live-checked Medusa's native product schema for the "characteristics"
  fields** (`material`, `weight`, `length`, `width`, `height`,
  `origin_country`, `hs_code`, `mid_code`) — every one of these fields
  **already exists** on the Store API response. Confirmed live: all 16 real
  products currently have every one of them `null`. This matters for
  Feature 4 (§4 below) — the architecture is free, the data isn't there yet.

## 1. Feature 1 — Product card layout

### Current state

Add to Cart currently overlays the bottom-right corner of the image
(hover-reveal on desktop, always visible on mobile since the Phase 5
mobile-usability fix). Order below the image: title → price. No stock line,
no code on the card.

### Your proposed hierarchy vs. my recommendation

You proposed: image → stock → Add to Cart → title → code → price → original
price. I'd keep most of it but flag one change, since you asked me to review
it rather than implement it blindly:

**Recommendation: keep price/title before the button, not after.** A
shopper scans a card to answer "what is this and how much" before "add to
cart" means anything — putting the button ahead of the price asks them to
commit before they have the information to decide. Standard pattern (and
what the "premium, easy to scan" goal points at) is: identity first
(image → title → code, small → price), then the decision affordance (stock
→ button) right where the eye lands next. Concretely:

```
[ product image, heart icon top-right ]
Product title
Κωδικός: PAN-10284          ← small, muted — same treatment as the PDP's
                                existing "Κωδικός προϊόντος" row, never
                                competing with title/price for attention
34,90 €    39,90 €           ← current price, original struck through
Σε απόθεμα                   ← or "Εξαντλήθηκε", small, colored dot + label
[  Προσθήκη στο καλάθι  ]    ← full-width button, own row, not floating
```

This still satisfies everything you asked for structurally (stock directly
above the button, button under the image rather than floating over it, code
visible but quiet) — it just reorders title/price ahead of stock/button.
**If you'd rather keep your original order exactly (button before
title/price), say so and I'll build it that way instead** — it's a real,
defensible choice some marketplace-style grids use for faster mobile
add-to-cart, I just don't think it's the better default for a considered,
premium home-goods purchase. Flagging as an open decision below (§6).

### What changes structurally either way

- Add to Cart moves from an absolutely-positioned overlay on the image to a
  real row below it — the image is no longer a click target that also has a
  button floating on top of it (a real, if minor, UX/hit-target issue in the
  current design, and a Core Web Vitals non-issue either way since nothing
  here is scroll-triggered).
- The hover-reveal-on-desktop / always-visible-on-mobile behavior (Phase 5)
  becomes moot once the button has its own row — it's simply always visible
  at every width, which is a simplification, not a regression.
- Multi-variant products keep the existing `Επιλογές`-links-to-PDP behavior
  (§2.3 of `PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md`), just in the new row
  position instead of overlaying the image.

## 2. Feature 2 — Wishlist

### Architecture: localStorage, mirroring "recently viewed" exactly — not a Medusa feature

Checked before proposing anything, per your instruction:

- **Medusa v2 has no built-in wishlist module or Store API endpoint.**
  Nothing to misuse or duplicate — there's no Medusa-native mechanism to
  defer to here.
- The storefront has **no customer authentication system** — checkout is
  guest-only by design (Phase 4B), and `/logariasmos` is a real link to a
  page that has never been built. A Medusa-backed wishlist would have to
  hang off a real `customer` record, which means building account
  creation/login first — a much larger, unrelated project, and not what
  was asked for here.
- **This codebase already solved an identical problem**: "recently viewed"
  is a real, working, per-visitor product list with no server-side account
  behind it — `localStorage` holds a list of product handles
  (`lib/recently-viewed-storage.ts`), and a Server Action
  (`lib/actions/recently-viewed.ts`) resolves those handles to real Medusa
  product data, since Server Components can't read `localStorage`. Wishlist
  is the same shape of problem, so it gets the same solution:
  `lib/wishlist-storage.ts` (read/toggle/list handles in `localStorage`) +
  `lib/actions/wishlist.ts` (resolve handles → real `Product[]` via the
  existing `getProductsByHandles`). No new Medusa surface, no parallel data
  layer, no custom backend work.
- **Forward-compatible, not a dead end**: if real customer accounts are
  ever built, this can migrate to a Medusa-customer-linked wishlist later
  without changing the UI — the storage key is the only thing that would
  move from the browser to the database.

### Interaction

- Heart icon, top-right corner of the product image, both on `ProductCard`
  and the PDP's main image. Outline when not saved, filled (`currentColor`)
  when saved — reuses the existing `HeartIcon` (already in
  `components/ui/Icons.tsx`, already used in the header), just adds a
  `filled` variant rather than a new icon.
- Click toggles instantly (optimistic — it's a synchronous `localStorage`
  write, there's no server round-trip to wait on), updates the header's
  wishlist count immediately, and gives a small scale/opacity micro-transition
  on the icon itself — **no toast, no drawer**, per "never interrupt the
  shopping experience." This is deliberately quieter than add-to-cart's
  toast, since add-to-cart is a bigger commitment (it touches the real
  Medusa cart) and wishlist is a lightweight, reversible bookmark.
- A real `/lista-epithymion` page (the header already links here — it's a
  404 today) replaces the placeholder: same `ProductCard`-grid pattern as
  `/anazitisi`, populated via the same handle-resolution Server Action.
  Without this the heart button would toggle a count with nowhere for the
  customer to actually revisit their saved items — building the page is the
  natural completion of the feature, not scope creep.
- Header gets a live count badge next to the heart icon, same visual
  treatment as the existing cart-count badge.

## 3. Feature 3 — Stock availability

- **PDP**: an explicit stock line directly above the Add to Cart button —
  `Σε απόθεμα` (a neutral/success tone) or `Εξαντλήθηκε` (muted, matching
  the existing out-of-stock color) — driven by the same
  `product.isAvailable` already computed from real Medusa inventory. Never
  hardcoded; if a product's stock changes in the admin, the next request
  reflects it (same 30s revalidation window the rest of the product data
  already uses — not instant/real-time, consistent with how price and
  every other product field on this site already behaves).
- **Grid cards**: same line, smaller, per the hierarchy in §1. This does
  add a small line of text to every card in every grid (today's cards don't
  show a positive in-stock state at all, only a corner badge for the
  negative case) — flagging that tradeoff explicitly since "always visible"
  makes every grid slightly busier. I think it's worth it here because you
  asked for it unconditionally ("the status must always reflect the actual
  inventory state" — not "only when out of stock"), and it directly serves
  the stated goal of the customer immediately understanding availability.
- Out-of-stock behavior (disabled button, consistent layout, no reflow)
  is already correct from Phase 5 — kept as-is, just re-labeled to sit in
  the new position.

## 4. Feature 4 — PDP content sections

### Description

Already exists (`product.shortDescription`, Medusa's `description` field)
— gets its own heading (`Περιγραφή`, `<h2>`) and its own section rather
than a bare paragraph, which is what makes it a real, crawlable content
section instead of an unlabeled block of text (this is most of the SEO
value here — a heading-scoped section reads as real content, not filler).

### Characteristics / Specifications

**Architecture, confirmed live (§0)**: Medusa's product schema already has
`material`, `weight`, `length`, `width`, `height`, `origin_country` — a
real "product characteristics" table, no new field needed, exactly the kind
of thing you've asked me not to duplicate. The section (`Χαρακτηριστικά`,
`<h2>`, a clean label/value table — same visual language as the existing
`Κωδικός προϊόντος`/`Παράδοση`/`Επιστροφές` metadata block) renders
**only the fields that are actually populated** for a given product — a
product with no data entered yet shows no characteristics section at all,
rather than a table full of empty dashes. This is the same honesty
principle already applied everywhere else in this project (no fake
ratings, no fake bestseller labels) — an empty spec is worse than no
section.

**The real gap: none of the 16 products have any of this data entered
yet** (confirmed live, §0). Building the display doesn't create content —
someone has to enter real material/weight/dimensions/origin per product in
the Medusa admin. I'm not going to fabricate plausible-sounding numbers for
a frying pan's weight or a towel's material; that would be exactly the kind
of fabricated-trust-signal problem this project has explicitly avoided
before (fake reviews, fake ratings). **Question for you** (§6): do you have
real spec data to provide for some/all products, or should this ship now as
a ready-but-currently-empty section, with data entry as a separate,
non-blocking follow-up task?

Two fields you mentioned (`Brand`, `Capacity`, `Color`, `Compatibility`)
don't have a dedicated native Medusa field — `Color` is normally a real
variant *option* (not applicable yet, catalog is 100% single-variant);
`Brand`/`Capacity`/`Compatibility` would go in Medusa's generic `metadata`
JSON field if/when needed, which the display can read from too, but I'd
rather wire that up when a product actually needs one of those fields
than build empty plumbing for all four speculatively.

### SEO

- Single `<h1>` (product title) is already correct and unchanged; the new
  `Περιγραφή`/`Χαρακτηριστικά` sections use `<h2>`, keeping the hierarchy
  logical (h1 → h2 → h2), not skipping levels.
- `Product` JSON-LD gains `material`/`weight`
  (schema.org's `QuantitativeValue` shape) when those fields are populated
  — same "only render what's real" rule as the visible table.
- All new content is plain server-rendered HTML (no client-side reveal, no
  hidden-until-interaction accordion hiding it from crawlers) — fully
  crawlable and indexable from first paint, satisfying "do not hide
  important content in a way that negatively affects SEO."
- No change to canonical/metadata/breadcrumb JSON-LD — already correct
  from the production readiness audit.

## 5. Performance / CVL / accessibility notes

- No new client-side JavaScript on the critical path: the wishlist heart is
  a small client island (same pattern as the existing quick-add button,
  which already makes `ProductCard` a Client Component), not a new
  page-wide script. Reading/writing `localStorage` is synchronous and
  local — no network request, no loading state, no CLS risk.
- Moving Add to Cart out of `position: absolute` and into normal document
  flow **removes** a layout-shift risk that existed before (an
  absolutely-positioned button doesn't shift layout, but hover-triggered
  `opacity`/`translate` transitions on it do trigger paint work); the new
  static row is strictly cheaper to render.
- The stock line and specs table are both plain server-rendered text —
  zero client JS cost.
- Heart icon: `aria-pressed` reflecting saved state, a real accessible name
  (`Προσθήκη στη λίστα επιθυμιών` / `Αφαίρεση από τη λίστα επιθυμιών`,
  not a static label that doesn't reflect state), 44px touch target on
  mobile (matches the existing `QuantityStepper` touch-target precedent
  from the cart).
- Specs table: a real `<table>` with `<th scope="row">` per label (or a
  `<dl>` if that reads better — same accessible pattern as the existing
  delivery/returns/payment block, just decide table vs. definition-list
  based on which renders more cleanly with a variable number of rows).

## 6. Decisions (confirmed by user 2026-08-09)

1. **Card hierarchy**: my recommendation — image (heart top-right) → title
   → code (small/muted) → price → stock → Add to Cart.
2. **Specs data**: ship empty-safe now — the Characteristics section
   renders only populated fields (nothing today), fills in automatically
   once real data is entered in the Medusa admin.

Approved. Proceeding to implementation.
