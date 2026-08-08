# Spec: Product Code (SKU) + Add-to-Cart Everywhere

Status: **proposed, not yet approved**. Written after inspecting the current
storefront/backend implementation and testing live against the real Medusa
Store API (`http://localhost:9000`, real 16-product catalog) — every claim
below about what Medusa already does was verified live, not assumed from
docs. Nothing in this document has been built yet.

## 0. Executive summary

Both features are smaller than they look, because the current codebase and
Medusa itself already do most of the work:

- **Product code**: Medusa's native `variant.sku` field already exists,
  already holds a real, unique, non-null value for all 16 real products
  (verified live), and is already **enforced unique at the database level**
  by Medusa itself. No new field, no custom uniqueness logic needed.
- **Search by code or name**: Medusa's built-in `/store/products?q=`
  already full-text-searches **both** product title and variant SKU —
  confirmed live with a real SKU (exact and partial substring) and a real
  Greek title word. No custom search index/service needed. The gap is
  purely storefront-side: the header already has a search `<input>`, it's
  just not wired to anything.
- **Add to cart everywhere**: `ProductCard` is already the single shared
  component rendering on every product grid in the app (home, category,
  subcategory, PDP related, PDP recently-viewed, cart cross-sell/empty
  state) and its quick-add already uses the toast (not the drawer) and
  already revalidates cart count/totals immediately. The real gaps are:
  no stock-awareness (inventory is hardcoded to `1` everywhere) and no
  multi-variant guard (it blindly adds `variants[0]`, even if a product
  ever had more than one). Fixing those two things in `ProductCard` and
  `AddToCartButton` fixes every page at once, because nothing else
  duplicates this logic today.

## 1. Feature 1 — Product code

### 1.1 Field choice: Medusa's native `variant.sku`

Inspected all four candidates per your instructions:

| Field | What it is in Medusa v2 | Fit as "product code"? |
|---|---|---|
| `product.id` | Internal ULID (`prod_01K...`), immutable | No — not human-readable, not meant for customers |
| `product.handle` | URL slug (`antikollitiko-tigani-28`) | No — already used for routing/SEO; changes if you ever rename the URL; not a "code" convention |
| `variant.sku` | Free-text field on each variant, **DB-uniqueness enforced by Medusa** | **Yes** |
| `variant.id` | Internal ULID per variant | No — same problem as product.id |

Live proof this is already real data, not empty:

```
GET /store/products?fields=id,title,+variants.sku
→ "Αντικολλητικό Τηγάνι 28cm" → sku: "ANTIKOLLITIKO-TIGANI-28"
→ "Σετ Κατσαρόλες Ανοξείδωτες 5 τεμ." → sku: "SET-KATSAROLES-5TEM"
... (all 16 products checked: 16/16 unique, non-null SKUs)
```

`sku` lives on the **variant**, not the product — this is Medusa's actual
data model, not a simplification. Today every product has exactly one
variant, so in practice each product has exactly one code right now. This
is the correct field per your instructions ("do NOT create duplicate
identifiers if Medusa already provides the appropriate architecture") —
`sku` *is* that architecture.

**Stability**: since `sku` is its own DB column, it is already fully
decoupled from title/category/price/images/description — editing any of
those in the admin does not touch `sku`. It only changes if someone
manually edits it. That satisfies "must remain stable" as-is.

**Uniqueness**: Medusa enforces a unique constraint on SKU at the product
module level (confirmed via Medusa's own issue tracker — duplicating a
product with a set SKU throws a DB unique-constraint error). The storefront
does not need to (and should not try to) re-implement uniqueness checking;
Medusa's Admin API already refuses a duplicate on creation/edit.

### 1.2 Multi-variant future (recommendation — please confirm)

The catalog is 100% single-variant today, so this is forward design, not
something I can verify against real data yet (flagging that honestly rather
than pretending it's tested). Standard convention, and what I'd propose:
once a product has real variants (size/color/etc.), **each variant gets its
own SKU** (e.g. `PAN-10284-RED`, `PAN-10284-BLUE`), and the PDP displays
whichever variant is currently selected. This is what Medusa's data model
already assumes, and it's how Zara/IKEA-style stores actually do it (the
code identifies the exact sellable unit, not just the "family"). Flagging
as a decision point since you asked me to recommend rather than assume.

### 1.3 Display

Proposed: **PDP only**, as a subdued line — not on `ProductCard` grid
tiles. Grid tiles are already dense (image, title, price, rating); adding
a code to every tile would clutter the grid and work against "do not make
it visually dominant." The PDP already has a quiet metadata block for
exactly this kind of detail (`Παράδοση` / `Επιστροφές` / `Πληρωμή`, styled
`text-ink-muted` labels + `text-ink` values) — adding `Κωδικός προϊόντος`
as one more row there reuses an existing pattern instead of inventing a
new visual treatment:

```
Κωδικός προϊόντος    PAN-10284
Παράδοση              2-4 εργάσιμες σε όλη την Ελλάδα
Επιστροφές            Δωρεάν εντός 30 ημερών
Πληρωμή               Κάρτα, Viva Wallet, αντικαταβολή
```

(Open question for you: happy with PDP-only, or do you also want it on
grid cards somewhere small, e.g. under the title in muted micro-text?)

### 1.4 Search

Live-tested against the real backend, unmodified:

```
GET /store/products?q=ANTIKOLLITIKO-TIGANI-28   → 1 result (exact SKU)
GET /store/products?q=TIGANI-28                  → 1 result (partial SKU)
GET /store/products?q=Τηγάνι                     → 2 results (Greek title word)
```

Medusa's default `q` search already indexes title, description, and
variant SKU together — I don't need to build or configure a separate
search index. Proposed storefront work (all frontend, zero backend
changes):

1. Wire the header's existing (currently inert) search `<input>` to a
   debounced call to `/store/products?q=`, showing a small live-results
   dropdown (thumbnail, title, price — reusing existing formatting, not a
   new visual language).
2. Enter / submit navigates to a new `/anazitisi?q=...` results page,
   built the same way `CategoryPLPView` is (grid of `ProductCard`, so
   add-to-cart works from search results for free once Feature 2 lands).
3. No fuzzy/typo-tolerant matching (Postgres `ILIKE`-style, not a real
   search engine like Meilisearch/Algolia) — acceptable at 16 products,
   called out here so it's a known scoping choice, not a silent gap, same
   as this project's existing "no fake bestseller" honesty standard.

### 1.5 Data layer changes

- `MedusaVariant.sku` already exists in `lib/medusa.ts` (fetched, unused) —
  just needs mapping through.
- Add `code: string` (or `sku`) to `ProductVariant` in `lib/types.ts`, plus
  a convenience `product.code` (the default/first variant's SKU) so PDP
  doesn't need to know about variant selection to show *a* code today.
- No backend/migration changes required — the field and its data already
  exist.

## 2. Feature 2 — Add to cart from every product list

### 2.1 What's already correct (verified by reading the actual components)

- `ProductCard` (`components/product/ProductCard.tsx`) is the **only**
  product-grid card component in the app. Confirmed every consumer:
  homepage (`Προτεινόμενα`, `Νέες αφίξεις` rails), PDP (`Σχετικά
  προϊόντα`, `Είδατε πρόσφατα`), category + subcategory PLPs
  (`CategoryPLPView`), and the cart page's cross-sell rail (`/kalathi` →
  `getCartCrossSell`). One component, one behavior, everywhere — this is
  the right foundation; Feature 2 doesn't need a second card type.
- Quick-add already shows the toast (`showAddedToast`) and **does not**
  open the drawer — confirmed by reading `CartUIProvider`: `isDrawerOpen`
  and `toast` are fully independent state, toast never touches the drawer.
  Already matches your spec.
- `addLineItemAction` already calls `revalidatePath("/", "layout")`, which
  re-renders `RootLayout` (header badge) and the current page — cart count
  and totals already update immediately, no polling/manual refresh.
- Discounts/coupons/tax/region: all still flow through the same Medusa
  cart (`/store/carts/:id/line-items`) — quick-add uses the exact same
  Server Action as the PDP's "add to cart," so there's no parallel cart
  logic to keep in sync.

### 2.2 Real gaps found (this is what actually needs building)

1. **No stock-awareness anywhere.** `lib/data/products.ts` hardcodes
   `inventoryQuantity: 1` on every variant, with a comment saying the
   Store API doesn't expose real stock without extra field wiring. I
   tested this live and that's now out of date:
   ```
   GET /store/products?fields=+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder
   → inventory_quantity: 99, manage_inventory: true, allow_backorder: false
   ```
   Real per-variant stock **is** available, just needs the right `fields`
   param — a single-line fix that unlocks real out-of-stock UI everywhere
   instead of the reactive-only approach used in cart/checkout today.
2. **No multi-variant guard.** Both `ProductCard`'s quick-add and the
   PDP's `AddToCartButton` call `product.variants[0].id` unconditionally.
   Harmless today (every product has exactly one variant) but exactly the
   inconsistent-behavior risk you're flagging — it would silently add the
   *wrong* variant the moment a real multi-variant product exists.
3. **PDP and `ProductCard` don't share a gating path** — two places doing
   "should this be addable" independently is exactly how they'd drift.

### 2.3 Proposed behavior

- **Availability** (`isAvailable`) computed once, per variant:
  `!manage_inventory || allow_backorder || inventory_quantity > 0`. A
  product is addable if the variant being added is available.
- **Single available variant** (100% of today's catalog): unchanged from
  today — direct add, toast, no drawer.
- **Zero stock**: button disabled, label becomes `Εξαντλήθηκε` — on
  `ProductCard`'s hover quick-add *and* the PDP's main button.
- **Multiple variants** (recommendation, please confirm — same as §1.2,
  this is forward design with no real data to test against yet):
  on `ProductCard`, don't quick-add; the card's hover button instead
  reads something like `Επιλογές` and links to the PDP rather than adding
  blindly. On the PDP itself (which already has full product context),
  add a simple variant picker (radio group) and keep the add button
  disabled until one is chosen. I'm recommending **against** building an
  inline popover variant-selector on grid cards for this phase — it's real
  UI complexity to design/test/verify with zero real multi-variant
  products to validate it against, which risks exactly the kind of
  half-finished, unverifiable feature this project avoids. Easy to add
  later once a real multi-variant product exists to build it against.
- **Search results page** (`/anazitisi`, §1.4): reuses `ProductCard`, so
  it inherits correct add-to-cart behavior automatically — no separate
  implementation.

### 2.4 Consistency check (your QC requirement)

Every current product-grid location, and why it'll behave identically
after this change (all route through `ProductCard`, which is the only
place the new gating logic lives):

| Location | Component | After this change |
|---|---|---|
| Homepage — Προτεινόμενα | `ProductCard` via `ProductRail` | same logic |
| Homepage — Νέες αφίξεις | `ProductCard` via `ProductRail` | same logic |
| Category PLP | `ProductCard` via `CategoryPLPView` | same logic |
| Subcategory PLP | `ProductCard` via `CategoryPLPView` | same logic |
| PDP — Σχετικά προϊόντα | `ProductCard` via `ProductRail` | same logic |
| PDP — Είδατε πρόσφατα | `ProductCard` via `ProductRail` | same logic |
| Cart page cross-sell | `ProductCard` via `ProductRail` | same logic |
| Search results (new) | `ProductCard` via new page | same logic |
| PDP main button | `AddToCartButton` (separate, by necessity — it's the full-page single-product context) | gets the same availability + variant-picker logic, just expressed as the main CTA instead of a hover quick-add |

No other product-card implementation exists anywhere in the codebase
(confirmed by search) — there is nothing else to fix.

## 3. Testing plan

Maps directly to your checklist; will be run manually against the live
backend (same standard as Phase 4A/4B — real completed actions in the
actual UI, not just `tsc`/build passing) before this is called done:

- All 16 real product SKUs confirmed unique/non-null (done above, live).
- Code displays correctly on PDP for a normal and a discounted product.
- Search: exact SKU, partial SKU, product name (Greek), a query that
  matches nothing (empty state).
- Add to cart from: homepage (both rails), category PLP, subcategory PLP,
  PDP, search results, PDP related, PDP recently-viewed, cart cross-sell —
  desktop and a real 375px mobile width.
- Out-of-stock product (will need to zero out real stock on one test
  product via the admin, then restore it) shows `Εξαντλήθηκε` and can't be
  added, in both `ProductCard` and PDP.
- A discounted product still adds correctly and totals recalculate.
- Coupon still applies correctly after adding via quick-add (not just via
  the PDP button) — this is a real gap in today's test coverage worth
  closing.
- `tsc`, `eslint`, `next build` clean.

## 4. Docs to update once built

Per this project's established handoff pattern: `CHANGELOG.md`,
`CURRENT_STATE.md`, `PROJECT_MEMORY.md`, `TASKS.md`, `NEXT_STEPS.md`.

## 5. Decisions (confirmed by user 2026-08-08)

1. Multi-variant on grid cards: **route to PDP** — card shows an
   "Επιλογές" link instead of quick-add for any product with >1 variant.
2. Product code display: **PDP only** — not on grid cards.
3. Search UI: **both** — live dropdown as you type in the header, plus a
   dedicated `/anazitisi` results page on submit/Enter.

Approved. Proceeding to implementation.
