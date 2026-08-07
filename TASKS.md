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

## In Progress

**Nothing is currently in progress.** Phase 3 closed out cleanly — every task
started this session was finished, verified, committed, and pushed before the
session ended. There is no partially-written code, no half-applied fix, no
uncommitted change to resume mid-stream. The next session starts a **new** task
from "Next" below, not a continuation of unfinished work.

## Next

**A decision is needed before coding starts** — see `NEXT_STEPS.md` for the full
reasoning. Short version: the roadmap's next phase (Phase 4, full PDP) leads
with two items that are currently blocked by missing real content (product
photography, multi-variant products), so the honest next action is picking
one of:

1. Skip to the unblocked Phase 4 items (recently-viewed, frequently-bought-together)
2. Jump ahead to Phase 5 (cart & checkout) — no content blockers, arguably more
   valuable for an actually-functioning store
3. Wait on Phase 4's blocked items until real assets exist

**Do not silently pick one of these without the user's input if this is a fresh
session with no way to ask** — flag it, per `NEXT_STEPS.md`.

## Future

**Phase 4 — Full product detail page**

- [ ] Real product gallery (multiple images, zoom) — **blocked**: needs real
      photography, which doesn't exist yet
- [ ] Variant/option selection UI — **blocked**: today's catalog is 100%
      single-variant, there's nothing to select and no way to test a selector
      against real data
- [ ] "Frequently bought together" / bundles — not blocked, buildable now
- [ ] Reviews + Q&A — **blocked**: needs a review system, which doesn't exist
- [ ] Recently viewed — not blocked, buildable now (client-side, e.g. localStorage)

**Phase 5 — Cart & checkout**

- [ ] Real cart (Medusa cart API), mini-cart drawer with live item count
      (header currently shows a static "0")
- [ ] Custom checkout flow — Greek address format, ΑΦΜ/ΔΟΥ + receipt-vs-invoice
      choice, Viva Wallet / Everypay integration, COD as a manual payment option
- [ ] Wire up the "Add to cart" buttons that currently exist as inert UI
      (`ProductCard` quick-add, PDP's `AddToCartButton`) — both intentionally
      `preventDefault()` today, not broken, just not built yet

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
