# Current State

Snapshot as of the end of the Phase 3 + audit session (2026-08-07). This documents
**what exists right now**, verified by inspection — not aspiration. Cross-check
against `git log` / the actual file tree if this ever feels stale; update it whenever
a session ends.

Git state: `main` branch, 3 commits, clean working tree, pushed and in sync with
`origin/main` (`git log --oneline`: `781c132` audit+Phase 3, `25fc221` Phase 2,
`25656a5` Phase 1).

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

Everything above is committed on `main` and pushed to
[thmavrakis7777/eshop7777](https://github.com/thmavrakis7777/eshop7777).

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
  breadcrumb, `Product` JSON-LD, inert "Add to cart" button (see UX decisions
  in `PROJECT_MEMORY.md` for why that's intentional right now).
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

## What has NOT been tested

- **Cart and checkout** — don't exist yet (Phase 5). Nothing to test.
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
  layout.tsx                    RootLayout — fetches nav categories, renders Header/Footer
  page.tsx                      Homepage
  globals.css                   Tailwind v4 theme tokens
  robots.ts
  sitemap.ts                    Dynamic, pulls real catalog
  [category]/page.tsx           Top-level category PLP
  [category]/[subcategory]/page.tsx   Subcategory PLP
  proionta/[handle]/page.tsx    Product detail page

components/
  layout/     AnnouncementBar, Header, Footer, MobileMenu
  home/       Hero, CategoryGrid, ProductRail, EditorialBanner, TrustStrip, Reviews, Newsletter
  category/   Breadcrumbs, CategoryPLPView, Pagination, SortControl
  product/    ProductCard, AddToCartButton
  ui/         PlaceholderTile, Stars, Icons

lib/
  types.ts           Domain types (Product, Category, NavCategory, Money)
  medusa.ts           Store API fetch client + raw Medusa response types
  format.ts           Price formatting (el-GR locale)
  site-config.ts       siteUrl / siteName (single source)
  search-params.ts     Safe sort/page query-param parsing
  data/
    categories.ts       Medusa → domain adapters for categories/nav
    products.ts          Medusa → domain adapters for products, sorting, pagination
```

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
- **1 admin user**: `admin@stia.gr` (password not recorded in the repo).

## Current API state

- Medusa exposes its standard **Store API** (`/store/*`) and **Admin API**
  (`/admin/*`) — no custom API routes exist (the two example stub routes from
  the scaffold were deleted as dead code during the audit).
- Storefront has **no API routes of its own** — it's pure Server-Component
  data fetching against the Medusa Store API, no Next.js `route.ts` handlers.

## Current components created

See "Current file structure" above for the full list — nothing has been started
and left half-built; every component listed is complete for its current scope
(e.g. `AddToCartButton` is a complete, working *inert* button — it's not a
half-finished cart feature).

## Current pages completed

`/`, `/[category]`, `/[category]/[subcategory]`, `/proionta/[handle]`,
`/robots.txt`, `/sitemap.xml`. Everything else linked from the header/footer is
a real link to a route that doesn't exist yet (see "What has NOT been tested").

## Current integrations completed

- **GitHub**: connected, authenticated, pushed.
- **Supabase**: connected, real data persisted there.
- **Vercel**: connected per the user, **not yet used for anything** — no
  deployment configured.
- **Medusa Admin**: working, reachable, real catalog visible.
