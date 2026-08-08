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
  parallel spacing tokens).
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
    on overflow — confirmed live. However **the Store API does not expose a
    per-variant stock count** on the products endpoint in this setup
    (`+variants.inventory_quantity` is silently ignored), so the UI cannot
    proactively show "only N left" or disable "+" at a known ceiling — it
    can only react to the real error after the fact. Don't try to fabricate
    a stock number to work around this; the honest behavior is reactive,
    not proactive, until inventory data is actually wired up.
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
  the session pooler) is in `apps/backend/apps/backend/.env` and has worked fine
  on this network despite direct connections normally needing IPv6 — if it ever
  stops connecting, the session pooler string is the fallback (Supabase
  dashboard → Connect → Session pooler).
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
- Coupon codes — the coupon UI/flow is real and verified end-to-end
  (`CART_UX_SPEC.md` §7), but no real promotion campaigns have been decided
  or created in the admin; only a temporary test code was used for
  verification and has since been deleted.
