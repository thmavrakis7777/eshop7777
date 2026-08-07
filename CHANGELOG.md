# Changelog

Notable changes, newest first. Written for whoever (human or agent) picks this up
next — focus on *why*, not just *what*.

## Audit + Phase 3 — real data wiring (2026-08-07)

**Full engineering audit of Phases 1–2** before starting Phase 3, per explicit
request. Real findings, not theatrical ones:

- `ProductCard` nested an interactive `<button>` inside a `<Link>` (`<a>`) —
  invalid HTML content model, broke expected focus/tab order. Restructured so
  the quick-add button is a sibling, not a descendant.
- `MobileMenu` had `aria-modal="true"` but no actual focus management — no
  initial focus on open, no Escape-to-close, no focus trap, no focus return on
  close. Added all four. (Also found and worked around a real limitation: the
  browser-automation tool's synthetic `computer.key` presses don't reliably
  reach this environment's page — confirmed via `document.dispatchEvent`
  succeeding where `computer.key` silently no-opped. Documented in
  PROJECT_MEMORY.md so it isn't re-debugged as a code bug next time.)
- JSON-LD `Organization.logo` pointed at `/logo.png`, which doesn't exist
  (`public/` is empty — no brand assets yet). Removed the field rather than
  ship a broken structured-data URL.
- `siteUrl` was hardcoded independently in `layout.tsx`, `robots.ts`, and
  `sitemap.ts`. Extracted to `lib/site-config.ts`.
- Backend `.env`/`.env.template`: `STORE_CORS`/`AUTH_CORS` allowed
  `localhost:8000` (Medusa's own starter-template default) instead of
  `localhost:3000`, where this storefront actually runs. Would have silently
  broken every Store API call from the browser with a CORS error. Fixed both
  files.
- `JWT_SECRET`/`COOKIE_SECRET` were still the scaffold's literal
  `"supersecret"` default. Rotated to real random values.
- Removed two unused example API route stubs (`/admin/custom`,
  `/store/custom`) left over from the Medusa scaffold, and a `pnpm.overrides`
  block in `apps/backend/package.json` that pnpm itself was already warning is
  ignored.
- `rating`/`reviewCount` were required fields defaulting to a fabricated 4.6
  rating / 128 reviews on every mock product. There is no review system —
  made both optional, `ProductCard`/PDP only render stars when a rating is
  real. Same reasoning applied to the homepage: relabeled "Τα πιο δημοφιλή"
  (implies real popularity ranking) to "Προτεινόμενα" (featured/curated) since
  there's no order history yet to back a bestseller claim.
- Removed dead `--space-*` CSS custom properties from `globals.css` (declared,
  never referenced anywhere — Tailwind's own spacing scale was already doing
  the job).

**Then Phase 3**: wired the storefront to real Medusa data end-to-end.

- `lib/medusa.ts` — typed Store API fetch client. `lib/data/categories.ts` and
  `lib/data/products.ts` adapt Medusa's response shapes into the storefront's
  existing domain types (`Product`, `Category`, `NavCategory`), so
  `ProductCard` and friends needed zero changes — exactly the point of having
  kept the mock layer shaped like Medusa's API since Phase 1.
- Header/Footer/MobileMenu/CategoryGrid/homepage switched from the static
  `mock-data.ts` import to server-fetched real data (`RootLayout` fetches
  categories once, passes down as props). `mock-data.ts` deleted once nothing
  referenced it.
- New real pages: `/[category]`, `/[category]/[subcategory]` (PLP — sort,
  pagination, breadcrumbs, `BreadcrumbList` JSON-LD), `/proionta/[handle]`
  (PDP — real price/description, `Product` JSON-LD). `sitemap.ts` now
  enumerates the real catalog.
- **Two real bugs found during Phase 3 verification, not just plumbing**:
  1. Medusa's Store API has no `currency_code` query param on
     `/store/products` — pricing requires `region_id`. Not documented
     anywhere obvious; found by testing the actual endpoint before building
     more code on the wrong assumption.
  2. The only sales region (created by Medusa's own default demo seed during
     Phase 2) didn't include Greece in its countries — `["de","dk","es","fr",
     "gb","it","se"]`, no `"gr"`. For a Greek storefront this would have
     broken checkout/tax entirely for real customers. Added Greece to the
     region and created a matching Greek tax region.
  3. Top-level category pages (e.g. `/kouzina`) showed "0 products" — products
     are tagged with one specific subcategory, and Medusa's `category_id[]`
     filter doesn't implicitly include descendants. `getCategoryIdsForHandle`
     now resolves the category's own ID plus its direct children before
     querying.
  4. PDP's "Add to cart" button had the same nested-interactivity-class bug as
     the earlier `ProductCard` fix — an inline `onClick` in an async Server
     Component. Extracted into `AddToCartButton`, a small Client Component.

## Phase 2 — Medusa backend on Supabase, real catalog

See `PROJECT_MEMORY.md` for the architecture. Summary: scaffolded Medusa v2 in
`apps/backend` (its own nested pnpm workspace, deliberately excluded from the
root workspace), connected it to a Supabase-hosted Postgres, replaced the
default demo catalog (T-shirts/sweatshirts) with the real IA — 28 categories,
16 products, seeded via the Admin API. GitHub connected via `gh auth login`;
pushed to `thmavrakis7777/eshop7777`.

## Phase 1 — Storefront foundation, design system, homepage

Next.js 16 + Tailwind v4 scaffold. Design tokens: Inter + Literata, both
verified via Google Fonts' metadata API to actually support Greek glyphs
(the original pick, Newsreader, turned out to have zero Greek coverage — caught
before shipping). Full IA wired into mega menu/footer/sitemap. Homepage
sections built against a Medusa-shaped mock data layer. SEO shell (metadata,
Organization JSON-LD, robots.ts, sitemap.ts).

Bugs found and fixed during that phase's own verification: two Server
Components passing event handlers (same class of bug that recurred in the
audit above — worth noting as a recurring pattern to watch for), a mega menu
that clipped off-screen for edge items, a real responsive dead zone
(768–1023px had neither the mobile hamburger nor the desktop nav), and a
mobile drawer trapped inside the header by a `backdrop-filter`-created CSS
containing block.
