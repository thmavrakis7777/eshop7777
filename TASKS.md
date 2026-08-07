# Tasks

Roadmap phases as originally scoped, tracked here so progress survives across
sessions. Mark items done as they land; add new ones as scope becomes concrete
(don't pre-fill Phase 5+ with guesses).

## Phase 0 — Research, IA, design system — done
## Phase 1 — Storefront foundation, homepage — done
## Phase 2 — Medusa backend on Supabase, real catalog — done
## Phase 3 — Storefront wired to real Medusa data — done

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

## Phase 4 — Full product detail page (not started)

- [ ] Real product gallery (multiple images, zoom) once real photography exists
- [ ] Variant/option selection UI (today's catalog is single-variant per
      product, so there's nothing to select yet — build this when a
      multi-variant product exists to test against)
- [ ] "Frequently bought together" / bundles
- [ ] Reviews + Q&A (needs a review system — doesn't exist yet)
- [ ] Recently viewed

## Phase 5 — Cart & checkout (not started)

- [ ] Real cart (Medusa cart API), mini-cart drawer with live item count
      (header currently shows a static "0")
- [ ] Custom checkout flow — Greek address format, ΑΦΜ/ΔΟΥ + receipt-vs-invoice
      choice, Viva Wallet / Everypay integration, COD as a manual payment option
- [ ] Wire up the "Add to cart" buttons that currently exist as inert UI
      (`ProductCard` quick-add, PDP's `AddToCartButton`) — both intentionally
      `preventDefault()` today, not broken, just not built yet

## Phase 6+ — Search, account, wishlist, content pages (not started)

- [ ] Predictive search (header search input is currently a plain text field
      with no backend)
- [ ] Account area, wishlist (header icons link to `/logariasmos`,
      `/lista-epithymion` — real pages, currently 404)
- [ ] About/legal/help content pages (footer links to these — real pages,
      currently 404; low priority, no business logic involved)
- [ ] Backend hosting decision (Vercel can't run Medusa's persistent server —
      deferred until actually needed, per explicit user decision)

## Housekeeping / non-blocking

- [ ] Rotate `JWT_SECRET`/`COOKIE_SECRET` again before any real deployment
      (currently locally-generated random values, fine for dev only)
- [ ] Decide on a real brand name/domain before any of this is public-facing
- [ ] Real product photography to replace `PlaceholderTile` everywhere
