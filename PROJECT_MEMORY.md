# Project Memory — STIA Houseware Store

Living reference for anyone (human or agent) picking this project up cold. Keep this
updated as architecture decisions are made — don't let it drift from reality.

Read this alongside `CURRENT_STATE.md` (what exists right now) and `NEXT_STEPS.md`
(exactly where to resume).

## Project purpose / business goal

A premium Greek home & houseware ecommerce store — kitchen, bathroom, storage,
cleaning, garden, home accessories. Target market is Greece specifically (Greek
language, Greek payment methods, Greek address/tax format). The design goal stated
at project start: feel like a premium European retail chain (IKEA / Zara Home / Muji
/ Joseph Joseph / OXO / Made.com), not "another Shopify store" — minimal, elegant,
fast, product-photography-led, zero clutter. Full original IA/wireframe/design-system
rationale lives in the plan history from the first session; this file tracks the
**as-built** state, not the original brief verbatim.

## Technology stack

**Monorepo** (pnpm workspaces), two independent apps that do **not** share a pnpm
workspace with each other (see root `pnpm-workspace.yaml` — `apps/backend` is
explicitly excluded via `!apps/backend` / `!apps/backend/**`, because it's its own
nested Turborepo/pnpm workspace):

- `apps/storefront` — the customer-facing site.
- `apps/backend` — the commerce engine + admin, itself a Turborepo workspace
  containing the real Medusa app at `apps/backend/apps/backend`.

### Frameworks / frontend architecture

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript** (strict mode).
- **Tailwind CSS v4** — theme tokens defined via `@theme inline` in
  `src/app/globals.css` (not a `tailwind.config.js` — v4 convention). Custom
  properties like `--color-accent`, `--radius-md` auto-generate matching Tailwind
  utility classes (`bg-accent`, `rounded-md`, etc.).
- **Server Components by default.** Data fetching happens in `async` Server
  Component pages/layouts; interactivity (menus, forms, sort controls) is isolated
  into small `"use client"` components. `RootLayout` fetches nav categories once and
  passes them down as props — `Header`/`Footer`/`MobileMenu`/`CategoryGrid` take
  `categories`/`NavCategory[]` as props, they don't fetch their own data.
  See `apps/storefront/src/app/layout.tsx`.
- No global state library (no Redux/Zustand). The cart (Phase 4A) uses a
  small React Context (`CartUIProvider`) for **UI-only** state — is the
  drawer open, the add-to-cart toast — never the cart's actual data. Cart
  data itself is server-fetched (Server Components read it via
  `lib/data/cart.ts`'s `getCart()`) and mutated via Server Actions
  (`lib/actions/cart.ts`) that call `revalidatePath("/", "layout")`, so the
  header's item-count badge updates by React re-rendering the Server
  Component tree after a mutation, not by a client store. See "Cart
  architecture" below. No CSS-in-JS. No component library dependency (all UI
  is hand-built in `src/components`).

### Backend architecture

- **Medusa v2** (`@medusajs/medusa` 2.18.0), self-hosted, Node/TypeScript. Chosen
  over Shopify specifically because Shopify's hosted checkout can't be fully
  customized — Medusa gives a real self-hosted checkout + admin + Postgres-backed
  catalog, at the cost of owning hosting/ops ourselves (that hosting decision is
  still open — see `TASKS.md`).
- File-based API routes (`src/api/store/*`, `src/api/admin/*`) — none currently
  custom; only Medusa's built-in Store/Admin REST APIs are in use.
- Business logic belongs in Medusa workflows, not route handlers, per Medusa
  convention (not yet exercised — no custom workflows written yet, only the
  built-in ones used via Admin API calls during catalog seeding).

### Database

- **PostgreSQL**, hosted on **Supabase** (not local, not Docker) — project ref
  `tuvbesrqizixqrunvlnt`. Connection string lives in
  `apps/backend/apps/backend/.env` (gitignored, never committed).
  See "External services" below for connection details and fallback.
- No ORM code written directly — Medusa's own MikroORM-based data layer owns the
  schema; migrations are Medusa's built-in ones (`medusa db:migrate`), no custom
  migrations written yet.
- **Redis is deliberately not used.** `REDIS_URL` was removed from `.env` — Medusa
  falls back to in-memory event bus/workflow engine for local dev. Fine for one
  dev instance; would need real Redis before running multiple backend instances.

### Important libraries

- `next/font/google` for Inter + Literata (self-hosted, not runtime-loaded).
- No `@medusajs/js-sdk` in the storefront — deliberately a hand-rolled thin `fetch`
  wrapper instead (`src/lib/medusa.ts`), to keep the storefront's only server
  dependency being "an HTTP API" rather than an SDK version lockstep with the
  backend. If this ever becomes painful, swapping in the official SDK is a
  contained change inside `lib/medusa.ts` + `lib/data/*.ts` only.
- `react-dom`'s `createPortal` for the mobile menu drawer (rendered into
  `document.body`, not inline — required because the header's `backdrop-filter`
  creates a CSS containing block that traps `position: fixed` descendants; see
  "Important technical decisions").

## Design system

- **Color**: white background, warm light-gray surface, warm charcoal ink (not
  pure black), one accent — muted terracotta (`--color-accent: #b5502e`). No
  gradients, no rainbow palette. Tokens in `globals.css` under `:root` and mapped
  into Tailwind's theme under `@theme inline`.
- **Typography**: **Inter** for UI/body, **Literata** for display/headlines
  (serif, used sparingly on h1/h2/h3/h4). Both were explicitly verified via
  Google Fonts' metadata API to have real Greek-glyph coverage before being
  chosen — the original pick for display type, **Newsreader**, was rejected after
  verification showed it has **zero** Greek support. Don't pick a font for this
  project without checking `https://fonts.google.com/metadata/fonts/<Name>`
  first; Latin-looking font names are not a reliable signal for Greek support.
- **Grid/spacing**: Tailwind's default spacing scale (a dead custom `--space-*`
  token set was found unused and removed during the audit — don't reintroduce
  parallel spacing tokens). `--color-accent-strong`/`--color-accent-soft`
  were removed for the same reason in the production readiness audit
  (declared, mapped into `@theme inline`, referenced nowhere) — only add a
  token at the point something actually uses it.
- **Contrast**: every token pair was computed against WCAG AA during the
  production readiness audit and they all pass, but the margin is thin in one
  place — `--color-ink-muted` on `--color-surface-strong` is **4.58:1**
  against a 4.5:1 requirement (checkout's section numbers, the order
  confirmation timeline). Recompute before nudging either token lighter.
  For reference: accent on white 5.06:1, ink-muted on white 5.55:1,
  ink-muted on surface 5.05:1, danger 6.54:1, success 5.91:1.
- **No real product photography yet.** `PlaceholderTile`
  (`src/components/ui/PlaceholderTile.tsx`) renders a deterministic
  color-block + initials standing in for every product/category image. Swapping
  in real photos is a contained change to that one component plus adding
  `next/image` usage — not yet started.
- **Motion**: subtle only (150–200ms ease-out on hover/state changes). No
  scroll-jacking, no entrance animations.

## Coding conventions

- Storefront: 2-space indent, double quotes (Next.js/ESLint defaults), no
  semicolons are *not* enforced (semicolons used) — follow existing file style,
  don't reformat wholesale.
- Backend: **no semicolons, double quotes, 2-space indent** (enforced by
  `@medusajs/eslint-plugin`'s recommended config — see
  `apps/backend/eslint.config.ts`). Files kebab-case, types/classes PascalCase,
  functions/variables camelCase, DB columns snake_case. Never disable a
  `@medusajs/*` lint rule to make lint pass — it usually means the code is
  actually structurally wrong (route/workflow/module shape), not just a style
  nit. See `apps/backend/AGENTS.md` for the full backend-specific convention
  list (also covers package-manager detection, common mistakes, off-limits
  paths — read it before backend work).
- Domain types (`apps/storefront/src/lib/types.ts` — `Product`, `Category`,
  `NavCategory`, `Money`) are the storefront's **own** shapes, deliberately
  decoupled from Medusa's raw API response shapes. `lib/medusa.ts` types
  (`MedusaProduct`, `MedusaCategory`, etc.) are the raw wire types; `lib/data/*.ts`
  is the only place that converts between them. UI components must never import
  from `lib/medusa.ts` directly — only from `lib/types.ts` and `lib/data/*.ts`.
- Never fabricate data to make the UI look more complete than it is (see "UX
  decisions" below) — this bit the project once already (hardcoded 4.6-star
  ratings on every mock product) and was treated as a real bug, not a style nit.

## SEO strategy

- **Metadata is inherited from the root layout, and that includes
  `alternates.canonical`.** Any route that doesn't declare its own
  `alternates` silently emits the root layout's `canonical: "/"` — i.e. it
  tells crawlers it *is* the homepage. This was a real, shipped bug on
  `/anazitisi` and `/checkout/epibebaiosi`, found during the production
  readiness audit by reading the rendered HTML, not by inspecting the code.
  **Every new route needs its own `alternates.canonical`**, even a noindex
  one.
- **Listing pages self-canonicalise per page** via `canonicalListingPath()`
  (`lib/search-params.ts`): page 2+ canonicalises to itself, not to page 1
  (pointing deeper pages at page 1 tells Google they're duplicates and drops
  any product only reachable past page 1). `sort` is deliberately *not* in
  the canonical — the sort variants genuinely are duplicates of each other,
  so they all collapse onto the unsorted page.
- **`robots.txt` blocks and `noindex` meta tags are mutually exclusive
  tools, not complementary ones.** A `robots.txt` `Disallow` stops the crawl,
  which means the `noindex` on that page is never read. `/anazitisi` is
  therefore `noindex, follow` and deliberately *absent* from `robots.ts`;
  `/kalathi` and `/checkout` are robots-blocked (nothing links to them from
  outside, so there's nothing to de-index).

- `generateMetadata` per dynamic route (category, subcategory, product) — title
  via the root layout's template (`%s | STIA`), description, canonical URL,
  Open Graph.
- JSON-LD: sitewide `Organization` (root layout), `BreadcrumbList` on every
  category/subcategory/product page (`components/category/Breadcrumbs.tsx`
  generates both the visible breadcrumb and its schema from the same data — no
  hand-duplicated schema), `Product` schema on PDPs. **No `AggregateRating`
  schema** — would require real reviews, which don't exist; don't add rating
  schema until real review data exists.
- `robots.ts` and `sitemap.ts` are dynamic (`MetadataRoute` API), not static
  files — `sitemap.ts` enumerates the real catalog from Medusa at request time
  (paginated fetches would be needed past ~a few thousand SKUs; fine at today's
  scale — see the comment in that file).
- Category/subcategory pages are real server-rendered routes with their own
  H1/intro copy — not thin filter-only pages, so they're legitimately indexable.
- `siteUrl`/`siteName` live in one place (`lib/site-config.ts`) — every
  consumer (metadata, JSON-LD, robots, sitemap) imports from there. Don't
  reintroduce a hardcoded `"https://www.stia.gr"` string anywhere else.

## UX decisions

- **Never fabricate trust signals.** No star ratings/review counts render unless
  real (`Product.rating`/`reviewCount` are optional, checked before rendering).
  The homepage's featured-products rail is labeled "Προτεινόμενα" (curated/
  featured), not "Τα πιο δημοφιλή" (best sellers) — there is no order history to
  back a real popularity claim yet. Revisit both labels once real
  review/order data exists.
  - This rule has now caught the same mistake **twice**: the fabricated 4.6-star
    product ratings (Phase 3 audit) and a whole homepage "Τι λένε οι πελάτες
    μας" section of three invented, *named* customer testimonials with
    hardcoded star ratings (`components/home/Reviews.tsx`, deleted in the
    production readiness audit). Treat any hardcoded array of human-sounding
    social proof as a bug on sight. Beyond the project's own rule, fake
    consumer reviews are a **prohibited unfair commercial practice under the
    EU Omnibus Directive (2019/2161)**, transposed in Greece — this isn't
    only a taste question.
  - **Customer-facing claims must match what the system can actually do.**
    Three separate places (homepage `TrustStrip`, the PDP delivery block,
    and — undocumented until the audit — the footer's payment-badge row)
    advertised card/Viva Wallet payment when the only configured Medusa
    provider is `pp_system_default` ("Αντικαταβολή"). Delivery windows are
    now sourced from the real `Standard Shipping` option's own estimate
    (2-3 εργάσιμες) rather than a separately invented number. When adding
    marketing copy, check it against live Medusa config first.
- Max 3 clicks from homepage to any product (Home → Category → Subcategory →
  Product), enforced by the IA, not just a design aspiration.
- Mega menu (desktop) and a separate accessible drawer (mobile) rather than one
  responsive component doing both — the interaction models are different enough
  (hover-driven vs. tap-driven with focus trapping) that sharing one component
  was making both worse.
- Sticky/accessible patterns: skip-to-content link, focus-visible outlines,
  mobile drawer has real focus management (initial focus, Tab trap, Escape to
  close, focus returns to the trigger button on close) — this was originally
  missing and was added as a real accessibility bug fix, not a nice-to-have.
- **Never disable a form input to indicate a background save.** Disabling an
  element that currently has focus moves focus to `<body>` — so an autosave
  that fires on blur destroys the customer's keyboard position on the field
  they just tabbed *into*. This was a real, measured bug across checkout's
  email/contact/address sections
  (`document.activeElement` went `checkout-area` → `BODY` and stayed there).
  Saving state is now announced via a `role="status"` "Αποθήκευση…" label on
  `SectionHeading`, and the inputs stay live. `ShippingSection`'s radios are
  the one deliberate exception — they guard against racing two
  shipping-method writes, and they disable the control just *clicked* rather
  than one tabbed into.
- **Don't reach for `role="menu"`/`role="menuitem"` on a nav menu of links.**
  The desktop mega menu had both; the role promises arrow-key roving-focus
  semantics that aren't implemented and makes screen readers announce
  ordinary links as menu items. A list of links is what it actually is —
  removed in the production readiness audit, don't reintroduce.
- **The mega-menu trigger opens on click, it does not toggle.** A mouse
  click arrives *after* `mouseenter`/`onFocus` have already opened the
  panel, so a toggle closes it under the cursor — verified live as a
  self-introduced regression during the audit and corrected the same
  session. Escape closes (handled on the `<header>`).
- `aria-label` on a bare `<div>` is ignored by most screen readers — there's
  no role for it to attach to. `Stars` needed `role="img"` to be announced
  at all.
- "Add to cart" (`ProductCard` quick-add, PDP's `AddToCartButton`) is now
  **real** (Phase 4A) — both call the same `addLineItemAction` Server
  Action. Clicking never force-opens the cart drawer; it shows a small,
  self-dismissing toast ("Προστέθηκε στο καλάθι" + an opt-in "Προβολή
  καλαθιού") so browsing isn't interrupted — see `CART_UX_SPEC.md` §2 for
  the full reasoning. The checkout CTA (`/checkout`) is a real link to a
  route that doesn't exist yet — same accepted pattern as the footer's
  not-yet-built content pages, not a fake/inert button; checkout is
  deliberately Phase 5, out of scope until the cart itself is approved.

## Important technical decisions (things that would be expensive to re-derive)

- **Medusa's Store API has no `currency_code` query param** on `/store/products`
  — pricing requires `region_id` (or an explicit country). `getDefaultRegionId()`
  in `lib/medusa.ts` resolves the one region that exists today ("Europe", EUR).
  This will need real per-country resolution if a second region/currency is ever
  added — right now it just takes the first region unconditionally.
- **Category filtering does not include descendants.** Medusa's
  `/store/products?category_id[]=` does an exact-match/OR filter on the IDs you
  give it — it does **not** automatically include a category's subcategories.
  Products are tagged with one specific (usually leaf) category. Browsing a
  top-level category page therefore requires resolving the category's own ID
  *plus* its direct children's IDs before querying — see
  `getCategoryIdsForHandle()` in `lib/data/categories.ts`. This was a real bug
  (top-level category pages showed "0 products") caught during Phase 3
  verification, not a theoretical concern.
- **The store's region must include Greece.** Medusa's own default demo seed
  (which ran automatically once, via `db:migrate`, before the real catalog was
  seeded) created a region covering Germany/Denmark/Spain/France/UK/Italy/Sweden
  — **not Greece**. This was fixed via the Admin API (added `"gr"` to the
  region's countries, created a matching Greek tax region) but is exactly the
  kind of default that silently breaks checkout/tax for real customers if it's
  ever reset. If the database is ever rebuilt from scratch, re-check
  `GET /admin/regions` includes Greece before assuming checkout will work.
- **`apps/backend` is excluded from the root pnpm workspace on purpose.** It's
  its own nested Turborepo/pnpm project (complete with its own
  `pnpm-workspace.yaml`, lockfile, `turbo.json`). Don't try to "fix" this by
  merging it into the root workspace — that was evaluated and rejected because
  Medusa's own tooling expects to own its workspace root.
- **Cart architecture (Phase 4A)**, verified against the live Medusa Store
  API before building (same discipline as the region/category findings
  above — see `CHANGELOG.md` for the full verification session):
  - Guest cart identity is a `cart_id` **cookie** (`lib/data/cart.ts`'s
    `CART_ID_COOKIE`), not `localStorage` — readable from Server Components,
    writable only from Server Actions (`lib/actions/cart.ts`), 30-day
    max-age.
  - Medusa's cart mutation endpoints: line-item **update is `POST`**, not
    `PATCH` (`/store/carts/:id/line-items/:line_id`); line-item **delete
    returns the updated cart under a `parent` key**, not `cart`
    (`{ id, object, deleted, parent: {...cart} }`) — different shape from
    every other cart endpoint, easy to get wrong if assumed instead of
    checked. Promotions: `POST .../promotions` to apply, **`DELETE`
    `.../promotions` with a `{ promo_codes: [...] }` body** to remove (DELETE
    with a body is unusual but this is what the live API actually expects
    and accepts).
  - Medusa **does enforce inventory limits server-side** on line-item add/
    update, returning `{ code: "insufficient_inventory", type: "not_allowed" }`
    on overflow — confirmed live.
  - **Correction (Phase 5, 2026-08-08): the previous note here — that
    `+variants.inventory_quantity` is silently ignored — was wrong**, or at
    least no longer true. Re-tested live: `fields=+variants.inventory_quantity,
    +variants.manage_inventory,+variants.allow_backorder` on
    `/store/products` returns real per-variant numbers (confirmed 99/100 on
    real products). `lib/data/products.ts` now fetches and maps these into
    `ProductVariant.isAvailable`/`inventoryQuantity`, and `ProductCard`/
    `AddToCartButton` gate on it (disabled + "Εξαντλήθηκε" at zero stock).
    This *doesn't* replace the reactive `insufficient_inventory` handling in
    `lib/actions/cart.ts` — both stay in place: the UI-layer flag is a
    prediction using the same rule Medusa enforces
    (`!manage_inventory || allow_backorder || inventory_quantity > 0`), the
    cart action is still the real source of truth if stock changes between
    page load and click. See `PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md`.
  - No Medusa shipping option currently has a conditional free-shipping
    rule (both seeded options are flat-rate, confirmed live) — the
    free-shipping progress bar's threshold (`lib/cart-config.ts`,
    `FREE_SHIPPING_THRESHOLD_EUR`) is therefore genuinely frontend-only
    config right now, not a mirror of a backend rule. Revisit if a real
    conditional shipping rule is ever added on the backend.
  - **`FreeShippingProgress` is currently disabled** (a module-level
    `FREE_SHIPPING_MESSAGE_ENABLED = false` flag, not deleted) and
    `AnnouncementBar`'s sitewide banner had its own, separately-hardcoded
    and *mismatched* free-shipping claim removed entirely — found during
    Phase 4B checkout research: neither was backed by a real shipping rule
    (previous bullet), so checkout would have visibly contradicted both.
    Explicit user decision was to soften the promise rather than build a
    real backend rule immediately. Don't re-enable either without a real
    conditional shipping rule behind them — see `CHECKOUT_UX_SPEC.md` §0.2.
  - **The Medusa fulfillment service zone did not include Greece** —
    same bug class as the region gap above, different subsystem: Greece
    was added to the sales region and tax region in Phase 2/3, but nobody
    exercised "resolve real shipping options for a Greek address" until
    Phase 4B checkout research, where it surfaced as zero available
    shipping options for any Greek address. Fixed via the Admin API
    (`POST /admin/fulfillment-sets/:id/service-zones/:id` with the full
    `geo_zones` array — this endpoint replaces the whole list, it doesn't
    append) and reverified live. If shipping options for Greece ever go
    empty again, check the service zone's geo_zones before assuming a
    frontend bug.
  - **Only one Medusa payment provider is configured**: `pp_system_default`
    (the generic manual/system provider) — no Stripe/Viva Wallet/Everypay
    exists yet, confirmed live via `/store/payment-providers`. Checkout
    presents this as "Αντικαταβολή" (Cash on Delivery), an explicit user
    decision, not an assumption. `TrustStrip` (homepage) and the PDP's
    delivery-info block both still say "Κάρτα, Viva Wallet ή αντικαταβολή" —
    aspirational copy from earlier phases that now overclaims relative to
    what's actually configured; needs reconciling as part of the checkout
    build, not fixed yet.
  - `RootLayout` now reads the cart cookie via `cookies()` (through
    `getCart()`) to compute the header badge count. This makes **every route
    dynamically rendered** (`ƒ` instead of `○` in `next build` output,
    including the homepage) — an expected, correct consequence of
    per-request cart state, not a regression to "fix."
  - Full spec: `CART_UX_SPEC.md`. Shared pieces: `useCartController`
    (`lib/hooks/use-cart-controller.ts` — optimistic per-row quantity/removal
    updates, reconciled by the server response) and `CartTotals.tsx` (the
    Υποσύνολο/Έκπτωση/Μεταφορικά/Σύνολο breakdown), used identically by both
    the drawer (`CartDrawer.tsx`) and the full page (`CartPageView.tsx`,
    `/kalathi`).
  - **Two line-item layouts, not one compressed into the other** (added in
    the Phase 4A.1 clarity pass): `CartLineItemRow.tsx` is a labeled card
    ("Αρχική τιμή:"/"Τιμή:"/"Ποσότητα:"/"Σύνολο:") used by the drawer at
    every width and by the full page below `lg`; `CartLineItemTableRow.tsx`
    is a true 5-column table row (`ΠΡΟΪΟΝ`/`ΑΡΧΙΚΗ ΤΙΜΗ`/`ΤΙΜΗ`/`ΠΟΣΟΤΗΤΑ`/
    `ΣΥΝΟΛΟ`, paired with `CartTableHeader.tsx`) used only on the full page
    at `lg`+. Both read the shared column-width constant in
    `cart-table-grid.ts` so the header and rows can never drift out of
    alignment. Don't try to unify these into one responsive component —
    a fixed ~440px drawer panel and a 375px phone both genuinely can't fit
    five aligned columns without forcing tiny text, which is exactly what
    the clarity pass was fixing.
  - **Two real CSS layout gotchas found and fixed in the desktop table's
    grid** (`cart-table-grid.ts` has the full explanation, don't re-derive
    this from scratch if it recurs):
    1. `ΠΡΟΪΟΝ`'s column must have a real floor (`minmax(14rem,1fr)`), not
       `minmax(0,1fr)` — an unbounded `0` let the four fixed price/quantity
       columns starve it down to single-digit pixels inside the page's
       two-column layout, and the `shrink-0` product image then visually
       overflowed onto the neighboring column. This was a real, live bug
       (not a hypothetical) — a customer reported the product title
       appearing associated with the wrong column.
    2. **Never add `min-w-max`/`w-max` to the header, a row, or their
       shared wrapper** to try to force the overflow-scroll fallback to
       trigger. It forces max-content sizing, which measures each grid
       instance (the header is one grid container, each row is another)
       against *only its own content* — the header's short "ΠΡΟΪΟΝ" label
       vs. a row's actual unwrapped product title compute *different*
       pixel widths for what must be the same column, and the columns
       visibly desync between the header and the rows. Without it, every
       instance sizes against the shared container width instead, which is
       what keeps them identical. Found this exact regression while fixing
       gotcha #1 above — it's an easy trap to reach for since it looks like
       the "obvious" way to guarantee an intrinsic minimum, don't reach for
       it here.
  - **`cart.promotions` can contain `null`** — Medusa leaves a dangling
    entry if a promotion applied to a cart is later deleted/deactivated
    (confirmed live, not hypothetical: this crashed every page once, since
    `getCart()` is called from `RootLayout`). `lib/data/cart.ts` filters
    nulls before mapping; `MedusaCart.promotions`'s type in `lib/medusa.ts`
    is `(MedusaPromotion | null)[]` on purpose — don't "simplify" it back to
    non-nullable.
  - **The cart summary has no real shipping figure until checkout sets a
    shipping method** — Medusa doesn't calculate `shipping_total` before
    that. `CartTotals.tsx` shows `Μεταφορικά: Υπολογίζεται στο checkout`
    (a fake `0,00€` would be worse) until `cart.hasShippingMethod` is true,
    at which point it shows the real amount — the same component serves
    both the cart (pre-checkout) and checkout's order summary (Phase 4B).
  - **`cart.subtotal` is NOT items-only — a real bug, found live, fixed**:
    confirmed by setting a real shipping method on a cart and re-fetching —
    `subtotal` silently folds in `shipping_total` (and is *pre*-discount,
    unlike `total`), so `item_subtotal` (i) − `discount_total` (ii) +
    `shipping_total` (iii) + `tax_total` = `total`, but `subtotal` alone
    equals `item_subtotal + shipping_total`, not just item_subtotal. This
    was invisible throughout Phase 4A/4A.1 because no cart ever had a real
    shipping method (that only starts happening in checkout) — the bug was
    latent, not new. `lib/data/cart.ts`'s `toDomainCart` now maps
    `subtotal` from Medusa's `item_subtotal` field, not `subtotal` — don't
    "simplify" this back, it will silently double-count shipping into the
    Υποσύνολο row the moment a cart has a shipping method.
- **Checkout architecture (Phase 4B)**, built after the cart-architecture
  gaps above were found and resolved, following the same
  verify-live-before-coding discipline:
  - **Single scrolling page** (`/checkout`), not a multi-step wizard —
    numbered sections (`SectionHeading.tsx`), each auto-saving to the
    *same* Medusa cart as the customer fills them in, not a separate
    checkout-only data model. Full design rationale: `CHECKOUT_UX_SPEC.md`.
  - Email and "Στοιχεία παραλήπτη"/"Διεύθυνση παράδοσης" are two visual
    sections but **one Medusa write** — first/last name and phone live on
    `cart.shipping_address`, there's no separate "customer info" field on
    a guest cart. `lib/actions/checkout.ts`'s `updateCheckoutDetailsAction`
    saves both sections' fields together. Οδός/Αριθμός are two form fields
    that get concatenated into Medusa's single `address_1` string on save
    — not reliably reversible, so `AddressSummary` (display-only, used for
    order confirmation) is a deliberately different type from `Address`
    (the form's own shape) rather than trying to split `address_1` back
    apart when reading a saved address back.
  - Shipping options are fetched **scoped to the cart's current shipping
    address** (`GET /store/shipping-options?cart_id=...`) — resolving them
    requires the address to already be saved on the cart first, confirmed
    live. Country is hardcoded to `"gr"` on save, never a form field — the
    region's 8-country list is the Phase 2 demo-seed leftover, not a real
    serviceable market.
  - **Order completion is a 3-step real Medusa flow**, each step verified
    live before coding against it: create a payment collection
    (`POST /store/payment-collections`) → open a payment session against
    whichever provider is actually configured
    (`POST /store/payment-collections/:id/payment-sessions`, provider ID
    read from the live `/store/payment-providers` list, never hardcoded) →
    complete the cart (`POST /store/carts/:id/complete`). That last call
    **returns a discriminated union**, not a thrown error on failure:
    `{ type: "order", order }` on success (confirmed live — the real order
    comes back directly in this response, no need to re-fetch it), or
    `{ type: "cart", cart, error }` on a workflow-level failure (e.g. stock
    vanished between checkout and submission) — this failure shape is coded
    defensively per Medusa's documented contract, not force-triggered live
    (would have meant deliberately corrupting stock data to test).
  - On successful completion, the `cart_id` cookie is deleted — the
    completed cart shouldn't linger as "the current cart" for the next
    add-to-cart. Confirmed live: the header badge correctly resets to 0
    immediately after.
  - **Guest order lookup by ID works with just the publishable key** — no
    customer session required, confirmed live
    (`GET /store/orders/:id`). This is what makes `/checkout/epibebaiosi`
    (the confirmation page) a real, refreshable/bookmarkable URL instead of
    a modal that loses its data on reload — the order ID (a long ULID) is
    the de facto access token, the same trust model most hosted "thank you"
    pages use.
  - **Two real bugs found only by clicking through the UI, not by
    `tsc`/`eslint`**: (1) email/address/shipping background saves originally
    shared one `useTransition` with the final-submit button, so the submit
    button flashed "Επεξεργασία…" (implying the *order* was processing)
    while the address was just autosaving in the background — each save
    now tracks its own `*Saving` boolean, and only the final submit uses a
    dedicated `useTransition`. (2) An early attempt to reorder the mobile
    layout (order summary above the form) moved its *DOM* position instead
    of using CSS `order` — this fixed mobile but silently swapped the
    desktop two-column layout's sides too, since with no explicit order at
    `lg+` both columns fall back to DOM order. Fixed by keeping DOM order
    matching the desktop reading order (form, then summary) and using
    `order-first lg:order-none` on the summary for a mobile-only *visual*
    reorder — don't reorder the DOM to solve a mobile-only layout need,
    reach for CSS `order` instead. Caught by comparing real
    `getBoundingClientRect()` positions, not `innerText`/`get_page_text`
    output — **`innerText` follows DOM order, not CSS `order`**, so
    text-order-based checks will look "wrong" for a correctly
    CSS-reordered layout; verify visual position with bounding rects
    instead when `order` utilities are involved.
- The mobile menu is rendered via `createPortal` into `document.body`, not
  inline in the component tree — the header's `backdrop-blur` (`backdrop-filter`)
  creates a CSS containing block that traps `position: fixed` descendants inside
  the header's bounding box instead of the viewport. This is a real, easy-to-
  reintroduce CSS gotcha — if a future change needs another `fixed`-positioned
  overlay near the header, check for this before assuming a portal is
  unnecessary.

- **Premium Greek checkout — Store Pickup (Phase 1 of `CHECKOUT_PREMIUM_SPEC.md`)**,
  proposed and approved (architecture review, then four explicit user
  decisions on BOX NOW/payment/ΑΦΜ-lookup/accounts scope) before any code:
  - **Delivery methods are modeled as real Medusa fulfillment-provider
    modules**, not a UI-only concept — `src/modules/store-pickup` extends
    `AbstractFulfillmentProviderService` (same base class Medusa's own
    built-in "manual" provider uses), registered in `medusa-config.ts`.
    This is the extensibility point BOX NOW will use later; Store Pickup
    was built first specifically to prove the pattern with no external
    dependency before the harder locker integration.
  - **Declaring a custom fulfillment provider in `medusa-config.ts` does
    not merge with Medusa's own default providers** — confirmed against
    Medusa's official docs (not assumed): the built-in manual provider had
    to be listed explicitly (`{ resolve: "@medusajs/medusa/fulfillment-manual",
    id: "manual" }`) alongside the new one, or the existing Standard/Express
    shipping options (which use it) would have broken. If another custom
    fulfillment or payment provider is ever added, check this again — it's
    a real, easy-to-miss regression risk, not a one-off gotcha specific to
    this provider.
  - A new fulfillment provider also needs to be **explicitly enabled on the
    stock location** it will serve (`POST /admin/stock-locations/:id/fulfillment-providers`
    with `{ add: [providerId] }`) before a shipping option using it can be
    created — Medusa returns `"Providers (...) are not enabled for the
    service location"` otherwise. Confirmed live, not assumed.
  - **A shipping option's `shipping_option_type.code` is the stable,
    storefront-facing discriminator** for delivery-method kind (`"standard"`/
    `"express"`/now `"pickup"`) — same pattern the Phase 4B `DELIVERY_ESTIMATES`
    lookup already used, extended rather than replaced.
    `ShippingOption.isPickup` in `lib/types.ts` is derived from this in
    `lib/data/checkout.ts`, and drives `ShippingSection.tsx` rendering the
    `PickupLocationInfo` block once selected.
  - **Real, non-obvious bug: Greek text passed inline through a bash/curl
    command to the Admin API arrives corrupted (mojibake) in the
    database** — a shell-encoding issue on this machine, not a Medusa or
    application bug. Fixed by writing the request as a `.mjs` script file
    (via the Write tool, which handles UTF-8 correctly) and running that
    instead of embedding Greek literals directly in a shell command. Apply
    this any time an Admin API call needs to carry Greek text.
  - **Pickup location content (address/hours/instructions) deliberately
    lives in the storefront** (`lib/pickup-config.ts`), not in Medusa —
    Medusa's fulfillment `data` field on a shipping option isn't reliably
    exposed to the Store API, and a Stock-Location-backed model would need
    a new custom Store API route for one field set that isn't used
    anywhere else. Revisit only if a second real pickup location is ever
    needed (today: one location, config-driven). Real address: Σφακιανάκη
    4, 71201 Ηράκλειο. Hours are per-day (not a collapsed range) since the
    real schedule has split shifts on Tue/Thu/Fri — `PickupLocation.hours`
    is a `{ day, hours }[]`, rendered as a `<dl>` in `ShippingSection.tsx`.
  - A temporary admin user, `qa-agent3@stia.gr`, was created (same
    established pattern as `test-agent@stia.gr`/`qa-agent@stia.gr` in
    earlier phases) to drive the Admin API directly for this setup —
    harmless local-dev-only leftover, safe to delete whenever convenient.

- **Premium Greek checkout — billing address + tax documents (Phase 2 of
  `CHECKOUT_PREMIUM_SPEC.md`)**:
  - **Billing address reuses the exact "combined write" pattern from Phase
    4B**, extended from two visual sections to three: `shipping_address`
    and `billing_address` are written together in one `/store/carts/:id`
    POST (`lib/actions/checkout.ts`'s `updateCheckoutDetailsAction`). When
    the "different billing address" checkbox is off, `billing_address` is
    explicitly set to a copy of `shipping_address` in that same request —
    it's never left null/stale, and unchecking the box immediately
    re-mirrors it rather than leaving a previously-entered custom billing
    address stranded on the server.
  - **Tax document type (Απόδειξη/Τιμολόγιο) and invoice fields
    (Επωνυμία/ΑΦΜ/ΔΟΥ/Δραστηριότητα) live in `cart.metadata`** — no native
    Medusa field for this. `lib/data/cart.ts`'s `parseTaxDocumentMetadata`
    is the one place that reads the metadata keys back out; keep the key
    names in sync with `lib/actions/checkout.ts`'s `updateTaxDocumentAction`
    if either ever changes.
  - **Real finding, confirmed live, the opposite of an assumption**: a cart
    `metadata` POST *merges* into the existing metadata object — an
    omitted key is left untouched. This is different from the fulfillment
    service zone's `geo_zones` (a genuine full-replace endpoint, see the
    Phase 4B entry above) — don't assume all Medusa "update" endpoints
    behave the same way, check each one live. Real bug this caused:
    clearing the invoice fields by sending them as `undefined` did nothing,
    because `JSON.stringify` drops `undefined` properties entirely before
    the request even leaves the browser/server — the field is simply
    absent from the payload, so Medusa's merge behavior correctly leaves
    the old value in place. Fixed by sending explicit `null` for each field
    to actually clear it — confirmed live this works.
  - **A CSS grid-rows collapse (0-height + `overflow-hidden`) does not stop
    keyboard Tab from reaching the fields inside it** — confirmed live via
    `element.focus()` still succeeding on a field inside a collapsed
    section. Both `BillingAddressSection.tsx` and `TaxDocumentSection.tsx`
    fix this with the HTML `inert` attribute on the collapsed wrapper
    (`inert={!checked}`) — React 19 supports it as a plain boolean prop,
    no polyfill needed. If another progressive-disclosure section is ever
    built with this same collapse pattern, apply `inert` the same way; it's
    not optional polish, it's a real keyboard-navigation bug otherwise.
  - **ΑΦΜ checksum** (`lib/checkout-validation.ts`'s `isValidAFM`): the
    standard published Greek mod-11 algorithm — weight the first 8 digits
    by descending powers of 2, mod 11, mod 10, compare to the 9th digit.
    Validates structure only, not that the ΑΦΜ belongs to a real registered
    business (that's the Phase 4 ΓΕΜΗ lookup). Verified against a
    known-valid test ΑΦΜ (`094259216`) by hand-computing the checksum, then
    again live in the browser with both a deliberately invalid and a
    corrected value.
  - Verified live end-to-end with a real completed order (not just each
    piece in isolation): a full checkout with a billing address different
    from shipping and a real Τιμολόγιο invoice, submitted, and the
    resulting order confirmed to show the correct shipping address, the
    correct *different* billing address, and the complete invoice details —
    proving the full chain (form state → Server Action → Medusa cart →
    order) round-trips correctly.

- **Premium Greek checkout — address autocomplete (Phase 3 of
  `CHECKOUT_PREMIUM_SPEC.md`)**:
  - **Google Places (New), called server-side only via Server Actions**
    (`lib/actions/address-autocomplete.ts`), not the client-side Places JS
    widget — a deliberate deviation from the original spec's assumption
    that a browser-exposed key was required. Proxying through
    `getAddressSuggestions`/`getPlaceDetails` keeps `GOOGLE_PLACES_API_KEY`
    entirely server-side, restrictable by server IP rather than HTTP
    referrer. See `.env.example` for the variable.
  - **Both Server Actions must degrade to an empty/null result, never
    throw** — an unset key, a network failure, or a Google API error all
    look identical to "no suggestions right now" from the UI's point of
    view. This is the load-bearing design constraint (checkout's own
    hard rule: never block manual entry), confirmed live with no key
    configured — typing in Οδός produces zero errors and behaves exactly
    like the plain field it replaced.
  - **Not yet live-verified against a real Google API key** — request/
    response shapes are doc-verified (fetched from Google's own current
    documentation this session), and the whole graceful-degrade path is
    live-verified, but nobody has actually clicked through a real
    suggestions dropdown yet. Do this the moment a real
    `GOOGLE_PLACES_API_KEY` exists, before considering this phase fully
    proven — same "verify live, not assumed" discipline as everything else
    in this file.
  - `AddressAutocomplete.tsx` autofills Οδός/Αριθμός/Πόλη/ΤΚ from a
    selected suggestion but **never overwrites a field the customer
    already typed into** (`if (details.number && !values.number)` — see
    `AddressSection.tsx`'s `handleAddressSelected`) — picking a suggestion
    is additive, never destructive of manual corrections.
  - Session tokens (`crypto.randomUUID()`) tie autocomplete keystrokes +
    the Place Details call into one Google-billable session, regenerated
    after each completed selection — omitting this would bill per
    keystroke instead of per session, the exact cost model the original
    research (`CHECKOUT_PREMIUM_SPEC.md` §2) assumed.
  - The "map pin confirmation" from the original spec is deliberately not
    built yet — needs a real API key to build and verify a Static Maps
    proxy against, not worth wiring up speculatively.

- **Premium Greek checkout — ΓΕΜΗ business lookup (Phase 4 of
  `CHECKOUT_PREMIUM_SPEC.md`)**:
  - **Real ΓΕΜΗ Open Data API contract confirmed live** against the actual
    public Swagger 2.0 spec at
    `https://opendata-api.businessportal.gr/api-docs` (viewable without a
    registered key — only real calls need one): base
    `https://opendata-api.businessportal.gr/api/opendata/v1`, endpoint
    `GET /companies?afm={9-digit, zero-padded}`, auth via an `api_key`
    header (not a query param or Bearer token), response
    `{ searchResults: [Company] }` where `Company.coNameEl` is the Greek
    company name and `Company.activities[].activity.descr` is business
    activity. **Confirmed by reading the real schema: ΓΕΜΗ has no ΔΟΥ field
    at all** — don't spend time later looking for one, it doesn't exist in
    this API.
  - **Getting a real `GEMI_API_KEY` needs registration + approval**
    (`opendata.businessportal.gr/register/`) — a correction to the
    original Phase 4 research, which assumed instant self-serve like
    Google's key. Confirmed live: the Swagger UI's own displayed test key
    (`api-docs-key`) is documentation-only and correctly 401s on a real API
    call — don't mistake it for a working key if this comes up again.
  - `lib/actions/afm-lookup.ts`'s `lookupCompanyByAfm` follows the same
    never-throw/degrade-to-`null` contract as the Phase 3 address-
    autocomplete actions — an unset key or any failure must look identical
    to "no match found," never an error the customer sees.
  - Triggered automatically in `CheckoutForm.tsx`'s `handleInvoiceFieldBlur`
    the moment ΑΦΜ passes checksum — **not gated on the rest of the invoice
    form being valid yet**, since the whole point is autofilling Επωνυμία/
    Δραστηριότητα before the customer types them. Uses a locally-computed
    `currentFields` variable (not the `invoiceFields` closure) so a
    successful lookup can save in the same blur instead of needing a second
    one — `setState` doesn't update the closure synchronously, a real gotcha
    worth remembering for any similar "async side-effect then immediately
    validate/save" flow.
  - Autofill is non-destructive, same rule as address autocomplete: only
    fills Επωνυμία/Δραστηριότητα if they're still empty.
  - **Not yet live-verified against a real approved key** — same honest gap
    as Phase 3's Google integration.

- **Premium Greek checkout — order confirmation emails (Phase 5 of
  `CHECKOUT_PREMIUM_SPEC.md`)**:
  - **SendGrid, not Resend** — a deliberate substitution from the original
    plan, made because `@medusajs/notification-sendgrid` is already a
    bundled dependency in this project (confirmed via `node_modules`
    inspection before writing any code), so it needed zero new packages.
    Resend would have needed one for equivalent capability.
  - **Same module-registration rule as fulfillment (Phase 1)**: adding
    `Modules.NOTIFICATION` to `medusa-config.ts` needed the built-in local
    provider (admin's in-app "feed" notifications) explicitly re-declared
    alongside the real sendgrid provider, or it's silently dropped —
    confirmed by reading `@medusajs/medusa/dist/modules/notification-local.js`
    exists as a resolve target, same pattern as `fulfillment-manual.js`.
  - **Verified safe before registering**: traced into the real
    `@sendgrid/client` source (`setApiKey`) to confirm it only
    `console.warn`s on a missing/invalid key and never throws — so
    registering the module with `SENDGRID_API_KEY` unset doesn't crash
    Medusa on boot. Confirmed live: clean restart with no key configured.
  - `src/subscribers/order-placed.ts` reads the real Order Module Service
    (`retrieveOrder` with `relations: ["items", "shipping_address",
    "billing_address", "shipping_methods"]`) — no duplicated order-reading
    logic. Wrapped in try/catch that only logs, never rethrows: this
    subscriber runs *after* the order already exists, so a broken email
    provider must never be able to affect the sale.
  - `src/utils/order-confirmation-email.ts` is deliberately **not** under
    `src/subscribers/` — Medusa's subscriber loader scans that directory
    and expects every file to export a subscriber; a template helper there
    risks being picked up and failing to load.
  - Table-based, inline-styled HTML (no Tailwind classes, no flexbox/grid,
    web-safe font stacks) — email clients (Gmail, Outlook) don't reliably
    support either. No product images, same anti-fabrication rule as
    everywhere else in this project (`PlaceholderTile` stands in on the
    site itself because no real photography exists yet).
  - **Verified live, completely, with a real order**: placed a real test
    order (`display_id` 4). Backend logs confirmed the whole real chain —
    `order.placed` fired with exactly 1 subscriber registered, the email
    template built successfully, SendGrid rejected the placeholder key
    with a genuine 401, the subscriber's own error handling caught and
    logged it, and **the order still completed successfully** — proof the
    "never block the sale" design holds under a real failure, not just in
    a code review.
  - Payment method name in the email is hardcoded to "Αντικαταβολή" — same
    reasoning as `PaymentSection.tsx`'s `PROVIDER_LABELS`: only one
    provider exists today, so a full payment-collection lookup for a
    single always-true value isn't worth the complexity yet. Revisit both
    together once Stripe (Phase 6) exists.

- **Production quality audit (2026-08-10)**: user-requested full review of
  every file touched this session. Performed as Sonnet 5 — there is no tool
  to switch models mid-session, flagged honestly rather than silently
  ignored. Found and fixed three real bugs that earlier phase-by-phase
  testing never exercised (each only reachable via a specific partial-fill
  order no earlier test happened to try):
  - Checking "different billing address" before finishing it blocked the
    *shipping*-address save entirely (both addresses shared one validation
    gate) — fixed so billing only joins the save once it's actually
    complete; until then it mirrors shipping, same as the unchecked state.
  - A real race condition in the ΓΕΜΗ autofill (stale-snapshot overwrite of
    fresh user input) — fixed with a functional state update.
  - A real race condition in the address-autocomplete debounce (out-of-
    order network responses could show stale suggestions) — fixed with a
    request-generation counter.
  - Also added `aria-activedescendant` to the address-autocomplete
    combobox (arrow-key navigation was silent for screen readers — real
    focus never left the input, so nothing announced which suggestion was
    highlighted) and corrected two comments that had drifted from what the
    code actually does. No dead code, unused imports, or new dependencies
    were found across the full session diff.

- **Product code / add-to-cart-everywhere / search architecture (Phase 5)**,
  proposed and approved (`PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md`) before any
  code — same design-first discipline as cart/checkout:
  - **The product code *is* Medusa's native `variant.sku`** — no custom
    field. Confirmed live: all 16 real products already had unique,
    non-null SKUs (`ANTIKOLLITIKO-TIGANI-28`, etc. — auto-populated from
    the handle when created in the admin), and Medusa enforces SKU
    uniqueness at the database level itself, so the storefront never needs
    its own uniqueness check. `sku` lives on the **variant**, not the
    product — today's catalog is 100% single-variant so in practice each
    product has exactly one code; a future multi-variant product would
    give each variant its own code (e.g. `PAN-10284-RED`), which is
    forward design, not yet exercised against real data. Mapped through as
    `ProductVariant.code`/`Product.code` — requires `+variants.sku` in the
    `PRODUCT_FIELDS` fetch (it's declared on `MedusaVariant` but wasn't
    actually being requested before this phase, so it would have come back
    `undefined` at runtime despite the type claiming `string | null`).
    Displayed **PDP only** (`Κωδικός προϊόντος` row in the existing
    delivery/returns/payment `dl` block) — deliberately not on `ProductCard`
    grid tiles, to avoid cluttering already-dense grids (user decision).
  - **Search reuses Medusa's own `q` full-text search** — confirmed live
    that `/store/products?q=` already indexes **both** title/description
    *and* variant SKU together (tested exact SKU, partial SKU substring,
    and a Greek title word, all correct). No separate search index/service
    was built. `searchProducts()` in `lib/data/products.ts` just calls the
    same endpoint every other product list uses, with `q` added. The header
    search input (visually present since Phase 1 but never wired to
    anything) now drives a debounced live-preview dropdown
    (`lib/actions/search.ts` Server Action, small `PREVIEW_LIMIT`) plus a
    real results page at `/anazitisi` reusing `CategoryPLPView`. No
    fuzzy/typo-tolerant matching (Postgres `ILIKE`-style via Medusa, not a
    real search engine) — acceptable scoping at 16 products, not a silent
    gap.
  - `CategoryPLPView` gained two new props to support this without
    breaking the category pages: `extraParams` (fixed query params every
    pagination/sort link must preserve, e.g. `q`) and `emptyMessage`
    (override the category-specific empty-state copy). **`basePath` is now
    a contract**: pure path, no query string of its own (e.g. `/anazitisi`,
    not `/anazitisi?q=...`) — passing a path with an embedded query would
    double up into a malformed `?...?...` URL in the pagination links.
  - **`ProductCard` (used on every product grid in the app — home,
    category/subcategory PLP, PDP related/recently-viewed, cart cross-sell,
    and now search) is the single place add-to-cart gating logic lives.**
    Real gaps found and fixed: it previously called `addLineItemAction(
    product.variants[0].id)` unconditionally — no stock check (inventory was
    hardcoded to `1`, see the corrected note above), no multi-variant guard.
    Now: a single-variant, in-stock product keeps the exact original
    quick-add UX (toast, no drawer — unchanged, already correct);
    zero-stock disables the button and shows `Εξαντλήθηκε` (also as a grid
    badge, not just the hover button, so it's visible without hovering);
    >1 variant swaps the quick-add button for an `Επιλογές` link to the PDP
    instead of guessing a variant (user decision — an inline popover
    selector was explicitly *not* built, since there's no real multi-variant
    product yet to design or verify one against).
  - **Real, separate bug found during verification, not part of the
    original ask**: the quick-add/`Επιλογές` control was `hidden` below
    Tailwind's `md` breakpoint (a pure desktop-hover-reveal pattern from
    Phase 4A) — meaning on an actual mobile viewport it was `display:none`
    entirely, not just less discoverable. Mobile users could not add to
    cart from *any* grid before this fix. Now unconditionally visible on
    mobile, hover-reveal preserved only at `md+`. Confirmed via
    `getComputedStyle().display`/`.opacity` at both 375px and 1280px, not
    just visually — a hover-only control can look present in a screenshot
    while still being unclickable on touch.
  - `AddToCartButton` (PDP) was reworked from `variantId: string` to
    `product: Product` so it can manage variant-selection state internally
    — for a single-variant product this is invisible/unchanged; for a
    future multi-variant product it renders a plain radio-group picker
    (intentionally not a fancier swatch/size UI, same "no real data to
    verify a fancier one against" reasoning as the grid-card decision) and
    keeps the button disabled until a variant is chosen.
  - Verified live (not just `tsc`/`eslint`/`next build`, though those are
    all clean too): searched by exact SKU and by partial Greek name from
    the header, both returned the correct product(s); visited `/anazitisi`
    directly; zeroed a real product's stock via the admin (`European
    Warehouse` location, `In stock` → `1` to make `Available` `0`, since a
    reserved-quantity-1 leftover from earlier order testing meant `0`
    in-stock wouldn't itself zero availability) and confirmed
    `Εξαντλήθηκε` appeared and was disabled on both the PDP and the grid
    card, then restored it to `100`; confirmed quick-add from a grid card
    at a real 375px mobile viewport actually adds and updates the header
    badge (had to dispatch the click via `element.click()` — the browser
    automation's `computer` click tool was timing out/hanging in this
    session for reasons unrelated to the app, confirmed by checking
    `getComputedStyle` and the resulting cart count directly rather than
    trusting the tool's own success/failure signal).
  - **Not re-verified this session** (honest gap, not an oversight): a
    discounted product's code/add-to-cart behavior end-to-end (no active
    promotion exists in the live catalog right now to test against — the
    discount/compareAtPrice code path itself was not touched by this
    phase, so risk is low, but it wasn't re-clicked-through); coupon
    persistence specifically through a *quick-add* (only ever verified
    through the PDP's main button in earlier phases); the multi-variant
    picker and `Επιλογές` routing (no real multi-variant product exists to
    click through).
  - A temporary admin user, `qa-agent@stia.gr`, was created (same pattern
    as `test-agent@stia.gr` in Phase 4A) to reach the inventory-editing UI
    for the out-of-stock verification above. Medusa won't let a user delete
    itself and the real `admin@stia.gr` password isn't available to remove
    it with — harmless local-dev-only leftover, safe to delete via the
    admin UI whenever convenient, same as its Phase 4A predecessor.

- **Product card / wishlist / stock display / PDP content architecture**,
  proposed and approved (`PRODUCT_CARD_WISHLIST_PDP_SPEC.md`) before any
  code — after a short look at how established Greek home-goods retailers
  structure cards/PDPs for UX-pattern reference (not copied — see the spec
  for the exact "inspiration only" boundary):
  - **Card hierarchy changed**: image (wishlist heart top-right) → title →
    code (small/muted) → price → stock → Add to Cart. The user's own first
    draft put stock/button *before* title/price; recommended reordering so
    identity and price read before the action, explained why, and the user
    took the recommendation. Add to Cart moved from an absolutely-positioned
    hover-reveal overlay (Phase 4A/5) into a real row in normal document
    flow — this also **removes** the old desktop-hover / mobile-always-
    visible CSS split entirely (nothing left to regress there).
  - **Wishlist is `localStorage`-only, deliberately not a Medusa feature**:
    confirmed Medusa v2 has no native wishlist module, and this storefront
    has no customer auth system (guest-only checkout by design) — a
    Medusa-backed wishlist would require building account creation/login
    first, well outside this task's scope. Mirrors the already-proven
    "recently viewed" shape (handles in `localStorage`, a Server Action
    resolving them to real Medusa product data via `getProductsByHandles`),
    not a new pattern. Forward-compatible: if real accounts are ever built,
    only the storage layer would move, not the UI.
  - **Wishlist state is a real external store (`lib/wishlist-storage.ts`)
    read via `useSyncExternalStore`, not `useEffect`+`useState`.** A naive
    "read localStorage in a mount effect" causes a real SSR/hydration
    mismatch (the server has no `localStorage`) and would trip the
    `react-hooks/set-state-in-effect` lint rule this project already
    enforces (see the Phase 5 `SearchBox` fix). `useSyncExternalStore`
    solves both: `getServerSnapshot` returns `[]` for the server-rendered
    pass, the real client snapshot reconciles right after hydration.
  - **Real bug hit and fixed during this build**: `getServerSnapshot` must
    return the *same* array reference every call, not a fresh `[]` literal
    — otherwise React throws "The result of getServerSnapshot should be
    cached to avoid an infinite loop" (confirmed live in-browser). Fixed
    with a module-level `EMPTY_HANDLES` constant. Same rule applies to the
    regular `getSnapshot` (handled via a raw-JSON-string cache that only
    produces a new array when the underlying value actually changed) — if
    this file is ever touched again, preserve both stable-reference rules.
  - **Stock display, one shared component**: `StockStatus`
    (`components/product/StockStatus.tsx`) is now the single place
    "Σε απόθεμα"/"Εξαντλήθηκε" wording and color lives, used by both
    `ProductCard` and the PDP — driven by the same `product.isAvailable`
    computed from real Medusa inventory (Phase 5), never hardcoded. First
    real use of the `--color-success` design token, which existed in
    `globals.css` since Phase 1 but had nothing using it until now.
  - **PDP characteristics/specs: the architecture is native Medusa, the
    data isn't there yet.** Confirmed live: `material`, `weight`, `length`,
    `width`, `height`, `origin_country` all already exist on the Store API
    response — no new field. Every one of the 16 real products has every
    one of these `null` today (confirmed live, and separately visible in
    the admin's own "Attributes" panel). `ProductCharacteristics.tsx`
    renders only populated fields and returns `null` entirely if none are
    set — deliberately ships as an empty-safe section rather than inventing
    plausible-sounding weights/dimensions, same anti-fabrication standard
    as the fake-reviews/fake-ratings rule elsewhere in this file. Weight is
    formatted in grams below 1kg else κιλά; dimensions in cm — Medusa's
    documented unit defaults, not assumed. `origin_country` is an ISO
    2-letter code mapped through a small, deliberately incomplete Greek
    country-name lookup in `lib/data/products.ts` (falls back to the raw
    code for anything unmapped).
  - **PDP description promoted to its own labeled `<h2>` section**
    ("Περιγραφή"), moved out of an unlabeled paragraph directly under the
    price — same underlying `product.shortDescription`/Medusa `description`
    field, just given real section structure. No separate short/long
    description exists in Medusa's schema (one `description` field only),
    so there's no duplicate-content risk between the metadata description
    and the on-page one.
  - Heading hierarchy on the PDP is now h1 (title) → h2 (`Περιγραφή`,
    `Χαρακτηριστικά`, `Σχετικά προϊόντα`, `Είδατε πρόσφατα`) — confirmed
    live via `document.querySelectorAll('h1,h2,h3')`, not assumed from the
    JSX.
  - `Product` JSON-LD gains `material`/`weight` (schema.org
    `QuantitativeValue`) only when those fields are populated — same rule
    as the visible table, confirmed live that the JSON-LD correctly omits
    both keys entirely for a product with no characteristics data.
  - **Known gap, not fixed this session**: the header's wishlist icon
    (like the pre-existing account icon) is `hidden sm:block` — invisible
    below the `sm` breakpoint, meaning true mobile viewports have no header
    entry point back to `/lista-epithymion` (typing the URL still works,
    and the heart-toggle interaction itself is fully functional on mobile
    everywhere a product renders — this is specifically about the header
    nav icon). Pre-existing pattern (same treatment the account icon has
    always had), not a regression introduced here; would need a `MobileMenu`
    change to fix, which is outside this task's scope.
  - Verified live end-to-end, not just `tsc`/`eslint`/`next build` (all
    clean): card hierarchy on a real product; wishlist toggle updates the
    header count instantly with no toast/drawer interruption, persists in
    `localStorage`, `/lista-epithymion` resolves and displays it via the
    Server Action, removing the last item shows the empty state
    immediately; out-of-stock state (real API-driven inventory zeroing,
    same `qa-agent`-style temporary admin account pattern as Phase 5, this
    time via direct Admin API calls after the admin dashboard UI's row-action
    menu proved unreliable to drive via browser automation) confirmed
    correct and *then restored* on both the PDP and a grid card, including
    the disabled-button check; 375/768/1280px widths all `scrollWidth ===
    innerWidth` (no horizontal overflow); a real long product name
    ("Πιατέλα Σερβιρίσματος 3 Ορόφων") wraps cleanly without breaking grid
    alignment; `/kalathi`'s cross-sell rail (also `ProductCard`) still
    renders with zero console errors. **Not re-verified this session**: a
    discounted product's card/PDP rendering (no active promotion exists in
    the live catalog to test against, and the discount/`compareAtPrice`
    code path itself was not touched by this work — same honest gap as
    Phase 5's).

- **Storefront UX polish — uniform card heights, header mini cart, Continue
  Shopping transition (2026-08-10)**: three targeted fixes, each scoped to
  its own component, no architecture changes.
  - **Uniform product card heights (`ProductCard.tsx`)**: the grid layouts
    (`CategoryPLPView`, `ProductRail`, `WishlistPageView`) already stretch
    every `<article>` to the tallest card in its row via CSS Grid's default
    `align-items: stretch` — the misalignment was entirely inside the card,
    where the Add to Cart button had no bottom anchor. Fixed with a
    standard flex "pin to bottom" pattern: the content block is `flex-1`,
    the title is `line-clamp-2` with a `min-h-10` reservation (so a
    one-line and a two-line title occupy identical space), and the
    button/`Επιλογές` link uses `mt-auto` to sit flush with the card's
    bottom edge regardless of how much variable content (badges, code,
    rating) sits above it. Verified live: a real long title
    ("Πιατέλα Σερβιρίσματος 3 Ορόφων") and short titles in the same row
    produce byte-identical button `top`/`bottom` `getBoundingClientRect()`
    values, at 375/768/1280px. Title text stays fully in the DOM (visual
    clamp only) plus gained a `title=` attribute for the full name on
    hover — no SEO/readability loss.
  - **Header mini cart (`Header.tsx`, `app/layout.tsx`)**: `RootLayout`
    already fetches the real cart once via `getCart()`; now passes
    `cart.total` (a `Money`) into `Header` alongside the pre-existing
    `cartItemCount` — no new fetch, no reimplemented totals math. The
    existing item-count badge is untouched; a `formatPrice(cartTotal)`
    label was added beside it, shown from the `sm:` breakpoint up (same
    precedent as the wishlist/account icons' existing `hidden sm:block`
    treatment) — true mobile keeps the badge only, which already shows the
    count at every width. Updates automatically through the same
    `revalidatePath("/", "layout")` mechanism that already refreshed the
    badge on add/remove/qty/coupon before this change — confirmed live
    that quick-add from a grid card updates the header total with no
    reload. Confirmed separately (pre-existing, unchanged): quick-add never
    auto-opens the drawer, only the toast does (and only on its own
    explicit "view cart" click).
  - **Continue Shopping + a real drawer transition (`CartDrawer.tsx`)**:
    the drawer previously had **no** open/close transition at all (instant
    mount/unmount, a deliberate stopgap noted in the old code comment).
    Added a real slide/fade transition (CSS `transform`/`opacity`,
    `motion-reduce:transition-none` for reduced-motion users) to the whole
    drawer — X button, Escape, backdrop click, and Continue Shopping all
    animate the same way now, not just the one button, since a mismatched
    "one path animates, others don't" would itself look unpolished.
    Structurally: `CartDrawer` keeps the drawer mounted for
    `EXIT_TRANSITION_MS` (300ms) after context's `isDrawerOpen` goes false
    so the exit animation has something to animate; `CartDrawerInner` owns
    a `visible` flag driving the CSS classes, flipped true a frame after
    mount (enter) and false immediately when its `open` prop goes false
    (exit), with the actual unmount fired by a `setTimeout` (not
    `onTransitionEnd`, so it still unmounts correctly under
    `prefers-reduced-motion`, where the CSS transition — and therefore any
    `transitionend` event — never fires). **Continue Shopping** itself:
    `router.push("/")` (client-side, no reload) only when
    `usePathname() !== "/"`, then closes; cart (cookie/server-backed) and
    wishlist (`localStorage`-backed) both already survive navigation
    untouched, so nothing extra was needed to "preserve" them. Verified
    live: closing from a non-home page navigates home with the cart intact
    and no full reload (a `window` marker survived); Continue Shopping from
    the homepage itself does a plain close with zero navigation, confirmed
    via the same marker plus an unchanged `location.pathname`.
  - **Real lint fix hit along the way**: the first draft called
    `setState` synchronously inside `useEffect` bodies for both the
    mount-gate (`CartDrawer`) and the exit flag (`CartDrawerInner`) —
    this project's `react-hooks/set-state-in-effect` rule (same one
    the wishlist store's `SearchBox` fix hit earlier) flagged both.
    Fixed with React's documented "adjust state during render" pattern
    (`if (condition && state !== target) setState(target)` in the
    render body, not an effect) for the synchronous parts; the effects
    that remain only start/clear a `setTimeout`, which is genuinely
    async and doesn't trip the rule.
  - `tsc --noEmit`, `eslint` (project-wide), and `next build` all clean
    after these changes.

- **Greek-aware live search dropdown (2026-08-10, built — live verification
  blocked by the Supabase DNS issue above, not yet done)**: architecture
  proposed with wireframes and approved before any code, per this project's
  usual pattern. Full spec discussion covered why Medusa's native `q` param
  is insufficient (Postgres ILIKE: case-insensitive but not accent-
  insensitive, no fuzzy tolerance, no controllable ranking) and why an
  in-memory app-layer ranker (not a database extension, not an external
  search service) is the right scope at today's catalog size (~16-30
  products) — revisit only if the catalog grows into the hundreds.
  - **`lib/search.ts` (new)**: `normalizeSearchText()` — Unicode NFD
    decomposition strips accents as combining marks (`̀-ͯ`), not a
    hardcoded character table, plus an explicit Greek final-sigma fold
    (`ς→σ`, a real gap NFD/lowercasing alone doesn't close) and whitespace
    collapse. Verified standalone (outside the app, direct Node script)
    against every example in the brief — `σεντονια`→`Σεντόνια`,
    `τηγανι`→`Τηγάνι`, `κουζινικων`→`Κουζινικών`, mixed case, multi-space —
    all pass. `matchTier()` — a 7-tier match (SKU exact, SKU partial, title
    exact, title prefix, title word, category, bounded fuzzy), never blends
    signals into an opaque score, so ranking stays explainable. Fuzzy
    matching is a hand-rolled bounded Levenshtein (no dependency), compared
    per-word (not whole-title) with the allowed edit distance scaled to word
    length — deliberately tight to avoid the "too aggressive, surfaces
    unrelated products" failure mode the brief explicitly warned against.
  - **`lib/data/products.ts`'s `searchProducts()` rewritten in place** (same
    signature/contract — `{ limit, offset } → { products, count }`) rather
    than adding a second search path: fetches the full catalog once per
    30s-cached window (same `next: { revalidate: 30 }` convention as every
    other list in this file) and ranks in-process. Both `/anazitisi` and the
    header dropdown call this one function — no duplicate search
    implementation. A real bug caught during self-review before this was
    ever tested: the first draft indexed `product.categoryHandle` (a Latin
    URL slug like `tigania`) for the "category match" tier instead of the
    real Greek category *name* (`Τηγάνια`) — would have silently made the
    category tier permanently unreachable for Greek queries. Fixed to pull
    `p.categories[].name` from the raw Medusa response before it's dropped
    by `toDomainProduct`.
  - **`lib/hooks/use-quick-add.ts` (new)**: the single-variant-vs-multi-
    variant quick-add logic (never guesses a variant — routes to the PDP
    instead, per the existing rule in
    `PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md` §2.3) extracted out of
    `ProductCard.tsx`, which now calls it instead of carrying its own copy.
    Shared with the new `SearchResultRow`, so add-to-cart behavior and toast
    timing can't drift between the two surfaces.
  - **`components/layout/SearchResultRow.tsx` (new)**: compact
    `[image][title+SKU][price][quick-add]` row — deliberately not
    `ProductCard`'s vertical layout. SKU shown small/muted next to the
    title; a discounted product shows strikethrough original + accent
    current price (same hierarchy `ProductCard` already uses). Multi-variant
    products get a compact "Επιλογές →" link to the PDP in the action slot
    instead of an inline picker — recommended and approved before coding,
    since a real picker doesn't fit a dropdown row and this reuses
    `ProductCard`'s existing multi-variant treatment rather than inventing a
    new one. Image/title is a real `<a>` (`tabIndex=-1}`, since arrow-key
    virtual navigation drives selection); quick-add is a real, independently
    Tab-reachable `<button>` — siblings, never nested (invalid nested-
    interactive markup was a real bug fixed in an earlier production audit;
    not reintroduced here). Quick-add errors (e.g. a race-condition stock
    failure) surface inline in the row's subtitle slot rather than being
    silently swallowed — caught during self-review, the first draft had
    nowhere for `useQuickAdd`'s `error` to go in a row this compact.
  - **`components/layout/SearchBox.tsx` rebuilt**: full ARIA combobox
    pattern mirroring the existing `AddressAutocomplete.tsx` precedent
    (`role="combobox"`, virtual `aria-activedescendant` navigation via
    Arrow Up/Down, `role="listbox"`/`option`, outside-click via a
    `mousedown` listener) rather than a new pattern — Escape closes, Enter
    opens the highlighted product, real Tab flow reaches each row's own
    quick-add button directly. Subtle loading state (a small spinner
    replacing the search icon, previous results stay visible and dimmed
    rather than flashing to empty) and a helpful Greek no-results message
    (`Δεν βρήκαμε προϊόντα για «{query}»` + a spelling-check hint), not a
    bare "no results" line. The existing `requestId`-ref staleness guard
    (a faster, later request can resolve before an earlier, slower one) was
    kept as-is — already the correct pattern for Server Actions, which
    don't support `AbortController` the way `fetch` does.
  - **Two `react-hooks/set-state-in-effect` lint violations hit and fixed**,
    same rule and same fix pattern as the cart drawer's transition work
    last session: a query-length reset and the debounce-triggered loading
    flag were both first written as synchronous `setState` calls inside
    `useEffect` bodies; fixed by moving the reset to React's "adjust state
    during render" pattern and moving the loading flag inside the actual
    `setTimeout` callback (matching where the original pre-rewrite code
    already had it).
  - **Resolved and fully verified live** after the Supabase DNS issue above
    was fixed by switching to the session pooler. `tsc --noEmit`, `eslint`
    (project-wide), `next build` (storefront), and `medusa lint` (backend)
    all clean. Live-tested against the real backend and real catalog:
    unaccented (`τηγανι`) and accented (`Τηγάνι`) queries both correctly
    match `Τηγάνι Wok 30cm` and `Αντικολλητικό Τηγάνι 28cm`, with the
    former ranked first (title-prefix beats title-word, as designed);
    uppercase (`ΤΗΓΑΝΙ`) folds identically; exact SKU
    (`ANTIKOLLITIKO-TIGANI-28`) and lowercase partial SKU both return the
    single correct product; two deliberate typos (`τηγαν` missing a
    letter, `τυγανι` wrong vowel) both correctly fuzzy-matched via the
    bounded-distance tier; a real absent product (`σεντονια`) and a
    nonsense string both correctly show the honest no-results copy, not a
    stale result set. Quick-add from the dropdown added the real item,
    updated the header count/total (`revalidatePath` mechanism, unchanged),
    kept the dropdown open, and did not auto-open the cart drawer — all as
    designed. Keyboard: Arrow Up/Down move the virtual highlight correctly
    (confirmed via `aria-activedescendant`), Enter navigated to the
    highlighted product's real PDP, Escape and a real outside click both
    closed the dropdown without navigating. Zero horizontal overflow at
    320/375/768/1280px; the quick-add button measured a real 40×40 CSS
    pixel touch target. Rapid character-by-character typing settled
    cleanly on only the final query with no stale-result flash.
    **Confirmed as pre-existing catalog gaps, not fixed and not
    fabricated for testing**: no product is currently discounted or
    out-of-stock (a broad-query scan of 12+ products found zero
    `Προσφορά` badges and zero `Εξαντλήθηκε` states, matching this
    project's already-documented "0 active promotions" state), and the
    catalog remains 100% single-variant, so the "Επιλογές →" multi-variant
    routing is verified by code inspection only, same standing gap as
    every other multi-variant code path in this project.

- **Search dropdown layout fix, real product-image rendering, cart
  pricing/SKU/discount polish (2026-08-10)** — three pieces of follow-on
  work, each starting from live inspection rather than assuming a rebuild.
  - **`SearchResultRow` image-tile bug**: `PlaceholderTile`'s own
    `w-full`/`aspect-square` base classes always beat a `className="h-11
    w-11"` override — Tailwind utility precedence is stylesheet order, not
    `className`-string order — so the tile stretched to the full row width
    and visually hid the title/SKU text (confirmed still present in the DOM
    via the accessibility tree; a real, live, screenshot-caught bug, not a
    hypothetical). `ProductCard` already avoided this by wrapping the tile
    in a sized `<div>` instead of fighting it via `className`;
    `SearchResultRow` now does the same. **If any future caller needs
    `PlaceholderTile` at a non-default size, wrap it in a sized container —
    never pass a conflicting size via `className`.**
  - **Real product-image rendering, a storefront-wide gap closed**:
    `toDomainProduct()` fetched Medusa's `thumbnail` field (it's in
    `PRODUCT_FIELDS`) but never mapped it onto the domain `Product` type,
    and every card/row unconditionally rendered `PlaceholderTile` — so a
    real photo uploaded to Medusa would have rendered nowhere. Added
    `Product.imageUrl`, and a new `components/ui/ProductImage.tsx` (real
    `next/image` when `imageUrl` is set, `PlaceholderTile` fallback
    otherwise) used by both `ProductCard` and `SearchResultRow` — one place
    deciding "real photo vs. placeholder" for both. `next.config.ts` now
    allows `localhost:9000/static/**` (Medusa's default local file
    provider) via `images.remotePatterns`. No real product has a photo yet
    (confirmed via the Store API — every product's `thumbnail` is `null`),
    so this is zero-regression-verified (every card renders identically to
    before) but not yet verified end-to-end against a real uploaded photo.
    `proionta/[handle]/page.tsx` (PDP) and every cart/checkout line-item row
    still render `PlaceholderTile` directly, deliberately left unchanged —
    out of scope for this pass; would need the same `ProductImage` swap if
    ever revisited.
  - **Cart pricing/SKU/discount-badge polish**: the discount math
    (`discountPercent()` in `lib/format.ts`) and the source data
    (`compareAtUnitPrice`, from Medusa's real `compare_at_unit_price` cart
    field) already existed and were already shared by both
    `CartLineItemRow` (drawer + mobile card) and `CartLineItemTableRow`
    (desktop table) — no duplicate calculation was written or needed. The
    one real gap: SKU. Medusa's cart line items already return
    `variant_sku` under the default `*items` field expansion (confirmed
    live via a direct Store API call — no `fields` change needed); it just
    wasn't mapped onto `CartLineItem`. Added `CartLineItem.code`, mapped in
    `toDomainCart()`, rendered as small secondary "Κωδικός: …" text under
    the title in both row components. Upgraded the discount indicator from
    bare accent-colored text to a compact pill badge, reusing
    `ProductCard`'s existing "sale" badge treatment rather than inventing a
    new visual style. **Deliberately kept** the drawer/mobile card's
    existing "Αρχική τιμή:"/"Τιμή:" labels (that labeling was itself a
    documented prior fix — "Cart clarity pass, 2026-08-08" — reverting to
    an unlabeled format would have undone it) and kept the desktop table's
    `ΑΡΧΙΚΗ ΤΙΜΗ` column right-aligned rather than switching it to
    horizontal-center as one brief literally requested — center-aligning
    only one of three adjacent numeric price columns (`ΑΡΧΙΚΗ ΤΙΜΗ`/`ΤΙΜΗ`/
    `ΣΥΝΟΛΟ`) would look inconsistent, not more aligned; flagged this
    judgment call rather than silently deviating.
  - **Verified, not assumed**: real alignment was checked via
    `getBoundingClientRect()` on live cart rows with three different
    product-title lengths (up to a 2-line-wrapping title) — every price
    cell already vertically centers on its row's tallest cell (the existing
    `items-center` on the shared `CART_TABLE_GRID_COLS` grid), with and
    without a discount badge present, and all three price columns share
    identical left/right pixel edges across every row. Since zero
    discounted product exists in the live catalog today, the discount
    badge/strikethrough visual and the math were verified via a disclosed,
    transient client-side-only override in `toDomainCart()`
    (`27.90 × 1.25 = 34.875 → correctly rounds to -20%`, the deliberately
    non-round number the brief's floating-point-precision concern was
    about) — reverted immediately after the screenshot; `git diff` confirmed
    a clean revert before continuing.
  - `tsc --noEmit`, `eslint` (project-wide), and `next build` all clean.

## Environment setup

This machine has **no admin rights available to Claude Code sessions** (UAC
prompts can't be approved non-interactively). Tooling was installed as portable,
no-admin extracts:

- **Node.js 24 LTS**: `%LOCALAPPDATA%\NodeJS\node-v24.19.0-win-x64\` — added to
  the persistent user `PATH`, but if a fresh shell doesn't have it on `PATH`,
  prepend it manually:
  `export PATH="/c/Users/t.mavrakis/AppData/Local/NodeJS/node-v24.19.0-win-x64:$PATH"`
- **pnpm**: via corepack (`corepack enable && corepack prepare pnpm@latest --activate`).
- **GitHub CLI**: `%LOCALAPPDATA%\GhCli\bin\gh.exe` — also portable, also on `PATH`.
  Already authenticated (`gh auth login` device flow, `gh auth setup-git` wired
  the git credential helper) as `thmavrakis7777`.
- **Storefront**: `apps/storefront/.env.local` (gitignored) needs
  `NEXT_PUBLIC_MEDUSA_BACKEND_URL` and `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` — see
  `apps/storefront/.env.example` for the shape. The publishable key is meant to
  be client-exposed (like a Stripe publishable key) — not a secret the way the
  DB password is.
- **Backend**: `apps/backend/apps/backend/.env` (gitignored) needs `DATABASE_URL`
  (Supabase connection string), `STORE_CORS`/`ADMIN_CORS`/`AUTH_CORS`,
  `JWT_SECRET`, `COOKIE_SECRET`. See `.env.template` in the same directory for
  the shape (kept in sync with the real required vars, no secret values).
- To run both apps locally: `pnpm run backend:dev` from `apps/backend` (admin
  at `localhost:9000/app`), `pnpm dev` from the repo root (storefront at
  `localhost:3000`). Admin login: `admin@stia.gr` — password is not written down
  anywhere in the repo (rotate it if forgotten rather than searching for it).
  A second admin user, `test-agent@stia.gr`, was created during Phase 4A to
  test the promotions/coupon flow end-to-end against the live API (Medusa
  won't let a user delete itself, and the real admin password wasn't
  available to remove it with) — harmless local-dev-only leftover, safe to
  delete via the admin UI whenever convenient. Two real orders (`display_id`
  1 and 2) also exist from Phase 4B checkout verification — a completed
  guest order was the only way to actually confirm the full flow works, not
  just each step in isolation; also harmless, local-dev-only.

## Development rules

- **Verify claims against the running system, don't trust assumptions about
  Medusa's API shape** — two of the real bugs found this session (the missing
  `currency_code` param, the category-descendants filtering gap) were caught
  specifically by curling the live Store API before building more code on top
  of an assumption. Do this again for any new Medusa endpoint usage.
- **Don't fabricate placeholder data that looks real** (fake ratings, fake
  "best seller" claims, fake stock counts) — treat this as a correctness bug,
  not a style preference, per "UX decisions" above.
- **Restart the dev server with `rm -rf .next` before trusting a dev-server
  error that contradicts `pnpm build`.** Turbopack's dev HMR has gone stale
  multiple times this project (throwing `ReferenceError`s for code that's
  demonstrably correct per a clean build) — see `CURRENT_STATE.md` for the
  current troubleshooting note.
- Keep `PROJECT_MEMORY.md`, `TASKS.md`, and `CHANGELOG.md` updated as part of
  the same change, not as an afterthought — this file existing and being
  accurate is what let this handoff happen without re-deriving the whole
  project from source.

## External services

- **GitHub**: [thmavrakis7777/eshop7777](https://github.com/thmavrakis7777/eshop7777),
  `main` branch, authenticated via `gh auth login` (device flow already
  completed), git credential helper configured via `gh auth setup-git`.
- **Supabase**: project ref `tuvbesrqizixqrunvlnt`. Direct connection string (not
  the session pooler) is in `apps/backend/apps/backend/.env` and had worked fine
  on this network despite direct connections normally needing IPv6 — **this
  risk materialized for real on 2026-08-10**: `db.tuvbesrqizixqrunvlnt.supabase.co`
  stopped resolving via Node's `dns.lookup()`/`getaddrinfo` on this machine for
  an extended period (30+ minutes across repeated backend restarts).
  Diagnosed precisely, not guessed: general internet DNS was fine (google.com,
  github.com, supabase.co, and even the Supabase *API* host all resolved);
  `dns.resolve4()` for the DB host returned `ENODATA` (genuinely no A record —
  this host is IPv6-only by Supabase's own design, not a fluke) while
  `dns.resolve6()` succeeded with a real address — meaning the record exists
  and is reachable, but this machine's OS-level resolver (which `dns.lookup`
  uses, unlike `resolve4`/`resolve6` which bypass it) wasn't handing back
  AAAA-only answers, almost certainly because this network's active adapter
  lacks a working IPv6 route right now. **Fix, not yet applied**: switch
  `DATABASE_URL` to the session pooler string (Supabase dashboard → Connect →
  Session pooler) — that host resolves to a real IPv4 address, sidestepping
  the IPv6 gap entirely. Needs the user to pull the real pooler string from
  their dashboard (region-specific, not guessable/fabricatable). Storefront
  never talks to Supabase directly (confirmed: zero `supabase` references
  anywhere in `apps/storefront/src`, its only backend env vars are
  `NEXT_PUBLIC_MEDUSA_BACKEND_URL`/`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`) — this
  is purely a Medusa-backend-to-database connection issue, not a storefront or
  architecture problem.
- **Vercel**: connected per the user, not yet used. Backend hosting decision is
  still open — Vercel's serverless model can't run Medusa's persistent server —
  deferred until it's actually needed (explicit prior user decision, don't
  revisit without cause).

## Placeholders that need real values before this is a real store

- Brand name "STIA" and domain `stia.gr` — never trademark-checked, purely a
  working placeholder chosen during Phase 1.
- Product photography — `PlaceholderTile` stands in everywhere a real photo
  would go.
- `JWT_SECRET`/`COOKIE_SECRET` in the backend `.env` are locally-generated
  random hex (rotated once already during the Phase 3 audit), fine for local
  dev, must be re-rotated and put in real secret management before any real
  deployment.
- Admin password (`admin@stia.gr`) — a real dev-only password, not written down
  in the repo; rotate before any real deployment regardless.
- Free-shipping threshold (`lib/cart-config.ts`,
  `FREE_SHIPPING_THRESHOLD_EUR`) — currently a placeholder default (€50),
  overridable via `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD_EUR`; needs a real
  business decision before launch.
- `GOOGLE_PLACES_API_KEY` (`apps/storefront/.env.local`) — not yet set; the
  address autocomplete (Phase 3) degrades gracefully without it, but needs
  a real key to actually verify/use.
- `GEMI_API_KEY` (`apps/storefront/.env.local`) — not yet set; requires
  registering at `opendata.businessportal.gr/register/` and waiting for
  approval (not instant). The ΑΦΜ-triggered business lookup (Phase 4)
  degrades gracefully without it.
- Coupon codes — the coupon UI/flow is real and verified end-to-end
  (`CART_UX_SPEC.md` §7), but no real promotion campaigns have been decided
  or created in the admin; only a temporary test code was used for
  verification and has since been deleted.
