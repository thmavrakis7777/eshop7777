# Project Memory — Houseware Store

## CURRENT ARCHITECTURE (2026-08-17) — read this section first

> Everything from "START HERE — CURRENT PROJECT STATE" downward is
> **historical**: it predates the `custom-dashboard-migration` branch and
> describes the old Medusa v2 backend, which no longer exists. Real
> product/UX decisions there are still worth mining, but any mention of
> Medusa, `apps/backend`, or `localhost:9000` is dead. `MIGRATION_PLAN.md`
> holds the phase-by-phase migration record; this section holds the
> resulting architecture.

### Stack

One Next.js 16 app (`apps/storefront`) — storefront and admin are two route
trees in it, not two apps — talking directly to Supabase Postgres (schema
`shop`) with `postgres.js`. No ORM, no Medusa, no `supabase-js`. Runtime
dependencies are `next`, `react`, `react-dom`, `postgres`, `server-only`,
`zod`.

### URLs

| What | URL |
|---|---|
| Storefront | `http://localhost:3000` |
| Admin | `http://localhost:3000/admin` (login at `/admin/login`) |
| Dev server | `pnpm dev` from repo root, or the `storefront` preview config |

Admin owner account: `th.mavrakis@gmail.com`. Password was reset
2026-08-16 to a temporary value handed over in chat — change it from
`/admin/settings`.

### Store branding — how to rename the shop

`shop.site_setting` is a singleton row holding `store_name`, `logo_path`,
`favicon_path`, `og_image_path`, `default_seo_title`,
`default_seo_description`, contact details and social URLs. Edit it at
**`/admin/content/layout`** (owner-only).

`lib/data/branding.ts`'s `getBranding()` is the single resolver every
user-visible brand mention reads: header/mobile-menu/footer logos, footer
copyright, the `<title>` template, Organization + WebSite JSON-LD, and
transactional email sender name and footer. `lib/site-config.ts` remains
only as the build-time fallback for when the settings row is missing or the
database is unreachable — it is not the source of truth.

Changing "Store name" in the admin renames the whole storefront. Nothing
about the brand is hardcoded in a component any more.

### Transactional email — Resend, not SendGrid (2026-08-23)

`lib/email/` is the one email service, split three ways: `send-core.ts`
(the actual Resend REST call — `POST https://api.resend.com/emails`, no
SDK, matching every other external integration in this codebase), `templates.ts`
(HTML/text builders), `send.ts` (the three public functions:
`sendPasswordResetEmail`, `sendOrderConfirmationEmail`,
`sendShipmentNotificationEmail`). Env vars: `RESEND_API_KEY`,
`RESEND_FROM_EMAIL`, optional `RESEND_REPLY_TO_EMAIL` — unset either of the
first two and every send degrades to a logged no-op
(`EMAIL_CONFIG_MISSING`) rather than blocking checkout, a shipment save, or
a password reset.

This is a reversal of an earlier explicit decision this session to stay on
SendGrid — done on direct instruction after that decision, not a
freelance change. SendGrid is fully removed (`.env.example`, all code) as
of this commit.

**Shipment notification (new)**: `shop.orders` gained `courier_name`,
`tracking_code`, `tracking_url`, `confirmation_email_sent_at`,
`shipment_email_sent_at` (`0015_shipment_tracking.sql`). Admin enters
courier + tracking on the order detail page (`ShipmentControls.tsx` →
`saveShipmentInfoAction`); the moment both are non-empty **and no shipment
email has ever been sent for that order**, one sends automatically —
`shipment_email_sent_at` is the guard, so re-saving (same values, or a
changed tracking code) never auto-sends a second time. The only way to send
again is the explicit "Επαναποστολή email αποστολής" button
(`resendShipmentEmailAction`), which always sends. No courier
tracking-URL templates are hardcoded — no verified official deep-link
format was confirmed for any Greek courier during this work, so tracking
URL is a manual optional field; without one the email just shows the
tracking code as text, per instruction not to invent a URL.

Both order emails now share one query, `getOrderForEmail()`
(`lib/db/order-email.ts`) — product image (currently always null, no
product photography exists yet — see "Images" below), SKU, per-item
pricing, address, payment method (only `cod` exists today), VAT
breakdown, shipping (a single total; the heavy/oversized-item surcharge is
already folded into `shipping_cents` by checkout, so the email cannot
honestly show it as a separate line without fabricating a split that
doesn't exist in the data).

### Legal identity — the shop's registered-entity fields (2026-08-19)

`shop.site_setting` also has `legal_company_name`, `vat_number` (ΑΦΜ),
`gemi_number` (ΓΕΜΗ) — added specifically because the legal pages need them
and nothing in the schema held them before. Edit at the same
`/admin/content/layout` form, owner-only, right below the VAT-rate field.
**All three are still empty as of this writing** — the legal pages
(Terms, Privacy) show a literal `[ΑΦΜ]` / `[ΓΕΜΗ]` placeholder in their
seeded text until the owner fills these in. There is no live template-
variable interpolation: filling in the Settings fields does **not**
automatically rewrite the bracketed placeholder already sitting in a legal
page's body — the owner has to also go edit that page's text once and swap
the placeholder for the real value. This was a deliberate simplicity choice
(a merge-tag system would be real added complexity for a one-time edit),
not an oversight — document it if it comes up as confusing.

### Legal & compliance pages — dashboard-editable, not hardcoded (2026-08-19)

Terms, Privacy, Cookies, Returns & Withdrawal, Shipping, Payments, Warranty
are **Content Pages** (see below), not a separate system — see the
CHANGELOG entry "Editable legal/compliance system" for the full reasoning,
what was reused vs. genuinely new, and the real CSP bug (GA4's regional
collect endpoint, `region1.google-analytics.com`, was silently blocked by
`connect-src` even after a visitor granted consent) found only by watching
the network tab after actually granting consent, not by reading the
snippet. Do not re-litigate whether to build a "proper CMS" for these —
that question was asked and answered this session, with the Content Pages
system deliberately extended (richer body format, SEO fields) rather than
duplicated.

Cookie consent is granular (Analytics / Marketing, no fake third
"Preferences" category — nothing in this codebase sets a preference
cookie) and reopenable from the footer's "Ρυθμίσεις Cookies" — see
`lib/consent-storage.ts`'s doc comments for the exact mechanism.

**Anything in the seeded legal text should be treated as a professionally-
structured starting template, not verified legal advice** — a Greek
lawyer/DPO should review it before real-world reliance, particularly: the
courier partner name (currently a bracketed placeholder — none exists
anywhere in the codebase to pull a real one from), and the Privacy Policy's
processor list if a new third-party service (email sending, a payment
gateway beyond Cash-on-Delivery) is ever added — that list must be updated
to match, never left describing an architecture the site no longer has.

### About page + content-page images/breadcrumbs (2026-08-19)

`sxetika` (Σχετικά με εμάς) went from an empty, unpublished row to real
Greek content — see the CHANGELOG entry "About page" for the content
strategy and the two real bugs found while building it (a nested-mark
parser limitation in `RichBody.tsx`, and three pre-existing category
slug/name mismatches — `katharismos`→"ΚΗΠΟΣ", `kipos`→"ΥΓΡΑΕΡΙΟ",
`eidi-spitiou`→"ΕΡΓΑΛΕΙΑ - ΗΛΕΚΤΡΟΛΟΓΙΚΑ" — confirmed in `shop.category`
directly, not fixed, needs its own redirect-aware pass later).

Content pages can now optionally carry an image (`image_path`/`image_alt`
on `shop.content_page`, migration `0013`) — edit from
`/admin/content/pages`, same `ImageUploadField` every other image field in
this admin uses, folder `"pages"`. All 13 content-page routes also render
real breadcrumbs (and `BreadcrumbList` JSON-LD) via the shared
`Breadcrumbs` component `ContentPageView` now takes a `path` prop for —
same component Journal and category pages already used, not a new one.

**Editor gotcha worth remembering**: don't write `**[label](url)**` in any
content-page or Journal body — the single-pass inline parser doesn't
support nested marks, and the whole thing renders as literal bracket text
inside a `<strong>` instead of a link. Write the link plain (`[label](url)`)
without wrapping it in `**...**`.

### Homepage CMS — how to control the homepage

The homepage is an **ordered list of sections** stored in
`shop.homepage_block`, composed at **`/admin/content/homepage`**. The admin
list order IS the page order, top to bottom.

Five section kinds:

| Kind | What it renders | Key settings |
|---|---|---|
| `hero` | Full-width banner | desktop + mobile image, alt, eyebrow/title/text, optional button + destination |
| `promo` | Two-column editorial banner | same field set as hero |
| `category_grid` | Category tiles | which categories and in what order (blank = all top-level, nav order); own heading |
| `product_rail` | Horizontal product strip | source: newest / featured / on sale / from category / from collection / **manual list**; count; optional "see all" link |
| `content` | Free-form image + text | image pair, alt, heading, body, optional button |

Per-section controls: **add, edit, hide/show, move up/down, duplicate,
delete**. Two or more *consecutive* hero sections merge into one carousel.
A section that resolves to nothing (e.g. a rail whose category was deleted)
renders nothing rather than an empty heading.

Schema shape: shared presentational columns (`eyebrow`, `heading`, `body`,
`cta_label`, `cta_href`, `image_path`, `mobile_image_path`, `image_alt`,
`sort_order`, `is_published`) plus one `config` **jsonb** for per-kind
settings — see `HomepageSectionConfig` in `lib/content-types.ts`. New
section kinds cost a type + a renderer case + an admin form case, **not a
migration**. The trade-off, accepted deliberately: `config`'s shape is
validated in `cms-actions.ts`'s `parseConfig()`, not by the database.

Code map:
- `lib/db/content.ts` → `getHomepageSections()` (cached, tag `homepage-blocks`)
- `lib/data/homepage-sections.ts` → `resolveRailProducts()`, `groupSections()`
- `components/home/HomepageSections.tsx` → kind → UI mapping
- `components/admin/HomepageSectionBuilder.tsx` → the builder UI
- `lib/admin/cms.ts` / `cms-actions.ts` → queries and Server Actions

The trust strip and newsletter are ordinary sections too. The guarantee
tiles are editable (icon from a fixed set of eight, title, description,
order, visibility) and live in the section's `config` jsonb. The newsletter
uses the section's own copy columns plus an optional background image. Its
form still has no submit handler — there is no mailing-list integration, and
inventing one would collect addresses nowhere.

### Journal — the editorial content system (2026-08-19)

The shop's content-marketing section: buying guides, home-organisation
ideas, kitchen and garden advice. Public name is **Journal**, never "Blog"
— that is a branding rule about user-facing copy only, which is why the
structured data still uses schema.org's `BlogPosting`.

Managed entirely from **`/admin/journal`** (list) → **`/admin/journal/new`**
→ **`/admin/journal/[id]`** (editor), with categories at
**`/admin/journal/categories`**. Publishing an article never requires a code
change.

Storefront URLs:

| URL | What |
|---|---|
| `/journal` | Landing: lead article + paginated card grid (12/page) |
| `/journal/[slug]` | One article |
| `/journal/kategoria/[slug]` | One category's articles |

Two tables, `shop.journal_category` and `shop.journal_article` (migration
`0011_journal.sql`). It is deliberately **not** built on
`shop.content_page`: that is a closed set of eleven slugs, each needing its
own literal route file, with no slug creation, dates, categories or images.
What *is* reused rather than duplicated is `shop.seo_meta` — per-article SEO
lives there under `resource_type = 'journal_article'`, the same polymorphic
table products and categories use, so there is one SEO storage shape in the
database rather than two. Migration 0011 only had to widen that table's
`resource_type` CHECK.

**The publishing gate is defined once**, in `lib/data/journal.ts`:
`status = 'published' AND published_at IS NOT NULL AND published_at <= now()`.
It lives in the WHERE clause of every storefront read, so a draft's body
never reaches the render layer and cannot leak through a component that
forgot to check. Drafts 404 on the storefront (same rule as an unpublished
content page) and are absent from the sitemap.

**Scheduling** is that gate plus a future `published_at` — no cron, no job
runner: the storefront renders per request and the article simply starts
being visible when its time passes (within the 60s cache window). Granularity
is one **day**: `<input type="date">` in the editor, converted to 08:00
Europe/Athens by Postgres's `AT TIME ZONE` (`lib/admin/journal.ts`). A
wall-clock time would have been ambiguous between a UTC server and a Greek
shop for no real gain.

**Content format** — `components/journal/ArticleBody.tsx`. No WYSIWYG, on
purpose: production runs a strict nonce'd CSP with no `unsafe-inline` on
`script-src` and no external script origins, and every mainstream editor
needs one or the other. It extends the plain-text convention
`ContentPageView.renderBody` already used (blank line = paragraph) with
`## `/`### ` headings, `- `/`1. ` lists, `> ` quotes, `**bold**`,
`[label](/href)` links and `[εικόνα: path | alt]` images. The parser emits
**React elements**, so there is no HTML string anywhere and nothing to
sanitise; link `href`s are still allow-listed against `javascript:`. Images
are real `<img>` elements — never a CSS `background-image`, which the CSP
blocks (see commit 5095f74).

**Related products** are optional and owner-chosen: a `text[]` of product
slugs on the article, filled by the existing `ProductPicker` (the same
newline-separated wire format the homepage's manual rail uses) and resolved
by the existing `getProductsByHandles`, which preserves the chosen order.
Zero cost when empty — the query is skipped entirely.

**Related articles** are automatic, not a join table: one query orders by
"same category first, then newest" and takes three. A brand-new category
with a single article therefore still gets a useful footer instead of an
empty section, and there is no second relationship for the owner to
maintain.

Journal is linked from the **footer only** (`components/layout/Footer.tsx`,
"Εταιρεία" column). The header stays focused on shopping.

Code map:
- `db/migrations/0011_journal.sql` → schema + the widened `seo_meta` CHECK
- `lib/data/journal.ts` → storefront reads, cache tag `journal`
- `lib/admin/journal.ts` / `journal-actions.ts` → admin queries + Server Actions
- `components/journal/ArticleBody.tsx` → the content parser/renderer
- `components/journal/JournalCard.tsx` → hero, cards, grid, category chips
- `components/admin/JournalArticleEditor.tsx` → the editor
- `components/admin/JournalCategoryManager.tsx` → categories

### Navigation — how to control the main menu

The header menu is an ordered list in `shop.nav_item` (`location='header'`),
composed at **`/admin/content/navigation`**. Six destination kinds:

| Kind | Resolves to |
|---|---|
| `category` | `/<slug>` — opens a mega menu if the category has children |
| `collection` | `/syllogi/<slug>` |
| `product` | `/proionta/<slug>` |
| `new_arrivals` | `/nea-afiksi` (fixed) |
| `sale` | `/prosfores` (fixed) |
| `custom` | any same-site path or `http(s)` URL |

Fixed routes are resolved in `resolveNavHref` (`lib/data/navigation.ts`), not
stored, so renaming `/prosfores` is a code change rather than an UPDATE
across every row.

**The category fallback is permanent.** With zero items configured the
header renders every top-level category, exactly as before this table was
used. A shop that never opens the screen still has a working menu — this is
not a migration step to be removed later.

Desktop renders it as its own full-width row below the logo (`flex-wrap`, so
a long list becomes a second line rather than an overflow). The mobile menu
renders **the same list, in the same order** — both read `navItems`, so they
cannot drift.

Per-item colours are optional, stored as `#rrggbb`, and validated in three
places: a column CHECK, the Server Action, and the form. They are emitted
only as inline `color`/`backgroundColor`, never as arbitrary CSS. The admin
shows a live WCAG contrast ratio and warns below 4.5:1 without blocking.

Code: `lib/data/navigation.ts` (storefront read + href resolution),
`lib/admin/navigation.ts` + `nav-actions.ts` (CRUD),
`components/admin/NavigationManager.tsx` (UI).

### Category hierarchy — three levels, one implementation

The shop's taxonomy is **main category → subcategory → sub-subcategory**, and
every part of it is generic: nothing anywhere names a specific category.

**Schema.** `shop.category.parent_id` is self-referencing and has always
allowed unlimited depth — no migration was needed for the third level. The
limit is a *routing* one: the storefront has three URL segments, so
`MAX_CATEGORY_DEPTH = 2` (zero-indexed) lives in `lib/category-depth.ts` and
is enforced by `saveCategory`'s `assertDepthFits`, which checks the new
parent's depth **plus the height of the subtree being moved** — re-parenting a
branch drags its children down with it. The admin form reads the same
constant so it never offers a parent the server will reject. Without this, a
fourth level would be creatable in the dashboard and 404 in the shop.

**One query, whole tree.** `lib/data/categories.ts` fetches every active
category in a single query (`fetchAllCategories`), including each one's
subtree product count computed in the same round trip. `unstable_cache` caches
the *flat rows* (tag `categories`, invalidated by admin saves);
`getCategoryTree` links them into a forest once per request via `cache()`.
Everything else derives from that one source:

- `getNavCategories()` — roots + featured copy, for header/footer/homepage.
- `getCategoryPath(segments)` — resolves a URL to `{category, ancestors,
  children}`, validating each segment is a *direct child* of the previous.
- `getCategoryTrail(handle)` — the full ancestor chain, for linking to a
  category from outside the category routes (the PDP breadcrumb).

Net effect: a subcategory page went from 4 category queries to 1, and adding
the third level cost zero extra queries. **Do not add a per-level query.**

The tree is built by walking *down from the roots*, not by attaching each row
to whatever parent slug it names. That is what makes deactivating a category
hide its whole branch instead of promoting its children to top level.

**Routing.** `[category]`, `[category]/[subcategory]` and
`[category]/[subcategory]/[subsubcategory]` are three four-line adapters onto
one `CategoryRoute` component — Next needs a file per segment count, but there
is only one implementation. Because `getCategoryPath` validates parentage,
each category is reachable at **exactly one URL**; `/banio/tigania` and a
stale `/kouzina/tigania` both 404 rather than duplicating a page.

**UI.** `CategoryChildNav` renders the current category's *direct children
only* — a full-width tappable row with a chevron on phones, an image card from
`sm:` up, same markup, no client JavaScript. The desktop mega menu shows two
levels (children + their children). The mobile menu drills to *any* depth but
still renders exactly one level at a time — never the whole tree flattened
out; see "Mobile menu drill-down" below.

Category images are admin-editable on **every** category (not just landing
pages) and fall back to the category's initial when unset — no shop category
has an image yet.

Owner-written category descriptions render **below** the product grid, not as
a subtitle. There is no auto-generated category copy: a templated
"Ανακάλυψε τη συλλογή X" line on every one of 33 categories was thin
duplicate content, and the real descriptions the owner had written were not
being shown at all.

### Mobile menu drill-down

`MobileMenu.tsx` is a progressive drill-down, not an accordion: main → sub →
sub-sub, one level on screen at a time, without leaving the overlay until the
shopper taps a real destination.

The state is a single `path: CategoryNode[]` — the categories drilled into,
outermost first. It is deliberately **not** in the URL. A menu level is not
somewhere the shopper can link to, and pushing history entries for it would
make the browser back button undo menu taps instead of page visits, exactly
when they most expect it to leave the page they just opened. The path doubles
as the href builder, since a category's canonical URL *is* its handle chain —
which is also why nav items are matched against **root** categories only: a
path that does not start at a root would not produce a valid URL.

Reset-on-close is structural, not an effect. `MobileMenu` renders the drawer
only while open, so closing unmounts the level state. (An effect that called
`setPath([])` on close is what the `react-hooks/set-state-in-effect` lint rule
exists to catch.)

Only a category with children gets a chevron and a `<button>`; everything else
— a childless category, SALES, NEW ARRIVALS, a custom link — stays a plain
`<Link>`. A chevron is a promise, and one that opens an empty level is worse
than no chevron. Nothing about the hierarchy is hardcoded: the menu reads the
same cached tree the header already loaded, so a category added or reordered
in the dashboard appears with no code change.

### Dynamic categories — SALES and NEW ARRIVALS

Neither is a row in `shop.category`. Membership is **derived**, so there is
no list to maintain and no way for the dashboard to disagree with the shop.

Both rules are defined **once**, as exported SQL fragments in
`lib/db/catalog.ts`, and imported by the storefront listings *and* the admin
views:

- `SALE_PREDICATE` — at least one active variant whose
  `compare_at_price_cents` is **strictly above** its `price_cents`. Strictly:
  an equal compare-at price is a price that was never reduced, not a 0%
  discount.
- `NEW_ARRIVAL_PREDICATE` — created within 30 days, **or** flagged with the
  pre-existing `is_new_override` column. The override can only ever ADD a
  product, never remove a genuinely new one, so it cannot contradict the date
  logic.

Do not duplicate these predicates. A second copy will eventually disagree.

In the admin they appear on the categories screen with live counts (two
`COUNT(*) FILTER` clauses in one query) and deliberately no
Edit/Delete/add-product controls. `/admin/products?dynamic=sale|new` filters
the normal product list. The product editor shows a read-only panel
explaining *why* a product is in each.

### Shipping — standard vs oversized

`shop.shipping_method` remains the standard cost chosen at checkout.
`shop.product` carries an optional `shipping_class`
(standard/heavy/large/custom) and `shipping_cost_cents`.

Two regimes in `computeTotals` (`lib/db/cart.ts`), never mixed:

- **all-standard cart** → the method's price once, waived above
  `free_over_cents`
- **any oversized item** → each oversized line pays its own cost × quantity,
  and standard items ride along free

So 1 normal = 3.50, 1 heavy + 1 normal = 8.00, 2 heavy + 1 normal = **16.00**.
The free-shipping threshold deliberately does not waive oversized costs.
Store pickup skips everything.

The class is descriptive only; the cost is what is charged. A class set
without a cost degrades to standard shipping rather than to a guess. The cost
is joined live from the product, not frozen onto the cart line like price is.

All of it is server-side; the Server Action re-validates the class against
its own allowlist and clamps the cost non-negative.

### Images

`lib/storage/urls.ts` derives a public URL from a stored **path**, and
passes an absolute `http(s)` URL straight through. So every image field
accepts either. File **upload** now works (`lib/storage/upload.ts`, one
`fetch` to Supabase Storage's REST API — no `@supabase/supabase-js`) and is
gated on `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`;
`/admin/content/media` explains the gap rather than showing a dead button
when they are absent.

One bucket (`product-images`), folder-namespaced. The folder allow-list is
`ALLOWED_FOLDERS` in `lib/admin/media-actions.ts` — currently
`categories`, `homepage`, `branding`, `journal` — and must stay in step with
the `folder` prop union on `components/admin/ImageUploadField.tsx`, or an
upload is silently rewritten to `uploads/`.

### SEO architecture

- Per-resource overrides in `shop.seo_meta`, keyed
  `(resource_type, resource_id)` where `resource_type` ∈ product, category,
  collection, page, homepage, journal_article. Read via `getSeoOverride()`.
  Widening that set means a migration (the column has a CHECK) *and*
  `SeoResourceType` in `lib/content-types.ts` — 0011 did both for the
  Journal.
- Site-wide defaults from branding (above).
- JSON-LD: Organization + WebSite (storefront layout), BreadcrumbList,
  Product with Offer/AggregateOffer, LocalBusiness/FAQPage (category landing
  pages), BlogPosting (Journal articles). All escaped via `lib/json-ld.ts`.
- `sitemap.ts` enumerates categories, collections, products, published
  Journal articles and non-empty Journal categories; `robots.ts` disallows
  admin/cart/checkout/account/wishlist. Journal drafts and not-yet-due
  scheduled articles are excluded by the same publishing gate the storefront
  serves, so the sitemap can never offer a URL that 404s.
- Paginated listings self-canonicalize on page 2+.
- `/prosfores` and `/nea-afiksi` have unique URLs, canonicals, titles,
  descriptions and breadcrumbs, and both are in the sitemap. **Known gap**:
  neither reads `shop.seo_meta`, so their SEO is not yet dashboard-editable.
  Closing it needs `SeoResourceType` widened plus a migration to relax the
  `resource_type` CHECK.
- `/prosfores` stays indexable even when empty: it is a permanent linked
  destination whose emptiness is temporary, and flipping robots on stock
  levels teaches crawlers the URL is unreliable.

#### 404s must return a real 404 — do not add a root `loading.tsx`

Invalid URLs return HTTP **404**, and there is a deliberate constraint keeping
it that way: **`(storefront)` must not contain a `loading.tsx`.**

A `loading.tsx` there puts a Suspense boundary above every storefront page.
Next then flushes the shell — committing the HTTP status as 200 — as soon as
the page's first `await` suspends, which happens *before* `notFound()` is
reached. The page renders 404 content under a `200 OK`, i.e. a soft 404: Google
indexes junk URLs and burns crawl budget on them. This was real, shipped
behaviour until the 2026-08-19 audit found it (see CHANGELOG); it is invisible
in a browser and only shows up in the response status.

If a loading state is ever wanted again, put the `<Suspense>` *below* the
`notFound()` decision — inside the page, around the slow part only, the way the
PDP already wraps `RelatedProducts` — never at the route-group root.

`(storefront)/not-found.tsx` renders the 404 inside the shop shell (header,
nav, footer) with links back into the catalogue. It is intentionally static —
no database call — because it is what renders after a lookup has already
failed, and bots crawling junk URLs should cost nothing.

### Performance architecture

- `unstable_cache` + precise `updateTag` invalidation on settings, promo
  banner, analytics, homepage sections, content pages, SEO, nav categories
  and the search catalogue.
- `React.cache()` for per-request dedup (`getNavCategories`,
  `getProductByHandle`, `getBranding`).
- `<Suspense>` around below-the-fold rails (e.g. the PDP's related-products
  block). **No route-group `loading.tsx`** — it was removed in the 2026-08-19
  audit because it turned every `notFound()` into a soft 404; see "404s must
  return a real 404" under SEO architecture before reinstating anything like
  it.
- One pool per instance (`lib/db/client.ts`), capped to 1 during
  `next build` — see MIGRATION_PLAN.md Phase 16 for the pooler-mode issue
  that is still open.

### Security posture

RLS enabled with zero policies on all 39 `shop` tables (access is
server-side via the connection string, which bypasses RLS by design — the
lockdown closes the PostgREST/Data API surface). Admin Server Actions all
call `requireAdmin()`/`requireOwner()` before reading arguments. Store-wide
settings (VAT, shipping prices, analytics, branding) are owner-only. See
MIGRATION_PLAN.md Phase 14 for the full audit and the fixes it produced.

---

## START HERE — CURRENT PROJECT STATE (HISTORICAL — pre-migration)

Written 2026-08-12, end of a very long session, specifically so a fresh Claude Code
session with zero conversation history can read this one section and understand
everything needed to continue accurately. Everything below is verified against the
actual repo/live systems as of this date — not aspirational. If anything here
conflicts with the more detailed sections further down this file (which can drift),
**trust this section and `CHANGELOG.md`'s dated entries first.**

### What this project is

STIA (placeholder brand name, `stia.gr` placeholder domain — **never registered, never
trademark-checked**) is a premium Greek-language home/kitchen/bathroom/garden ecommerce
store, currently in active development, not yet publicly launched. Repo:
[thmavrakis7777/eshop7777](https://github.com/thmavrakis7777/eshop7777) on GitHub, `main`
branch, currently pushed through commit `68cbfdf`.

### Architecture — do not change without explicit user sign-off

```
Next.js 16 (App Router, Turbopack) storefront  →  Medusa v2 backend  →  Supabase Postgres
   apps/storefront                                 apps/backend/apps/backend
```

- **Frontend**: `apps/storefront` — Next.js 16.3.0, React 19.2.8, Tailwind v4, TypeScript.
  **This Next.js version has real breaking changes from any model's training data** — e.g.
  `middleware.ts` is renamed `proxy.ts` in this version (`src/proxy.ts` exists and is
  correct). Always check `apps/storefront/node_modules/next/dist/docs/` before assuming
  an API behaves like an older Next version.
- **Backend**: `apps/backend/apps/backend` — Medusa v2.18.0, a Turborepo monorepo nested
  two levels deep (`apps/backend` is the outer Turborepo root with its own
  `pnpm-workspace.yaml`, deliberately excluded from the repo-root workspace; the actual
  Medusa app is `apps/backend/apps/backend`, package name `@dtc/backend`). 10 custom
  modules exist: `analytics-settings`, `content-pages`, `homepage-blocks`,
  `media-assets`, `product-extras`, `promo-banner`, `search-synonyms`, `seo`,
  `site-settings`, `store-pickup` — all part of the "Admin-first platform" roadmap
  (Phases A–K, complete) that lets the store owner manage content/SEO/merchandising from
  the Medusa Admin dashboard with zero code changes.
- **Database**: Supabase-hosted Postgres. Medusa connects with a direct, privileged
  connection (`postgres` role, confirmed to have `BYPASSRLS`) — **not** through
  Supabase's PostgREST/Data API. No `supabase-js` or any Supabase client SDK exists
  anywhere in either app; Supabase is purely Medusa's Postgres host.
- **Local dev setup**: both dev servers must be started fresh each session via
  `.claude/launch.json`'s `preview_start` configs (`backend`, `storefront`) — they don't
  persist across sessions. Backend cold-boots in ~100-150s (don't assume a 45-60s
  timeout means it hung). Storefront: `http://localhost:3000`. Backend:
  `http://localhost:9000` (admin at `/app`).
- **Planned production architecture** (prepared, **not deployed** — see Deployment
  below): Vercel (free tier) for the storefront, Railway for the Medusa backend,
  Supabase unchanged. No Medusa Cloud, no Redis (confirmed unused anywhere in the
  codebase — the app's event bus/workflow engine use Medusa's in-memory defaults).

### What must NOT be changed without explicit user instruction

- The architecture itself — no migrating Medusa to Supabase's own API layer, no new CMS,
  no framework swap.
- `apps/backend/apps/backend/src/migration-scripts/initial-data-seed.ts` — Medusa's
  default seed script.
- `.env` / `.env.local` (both gitignored) — never print, commit, or copy secret values
  out of them.
- The lockfiles (`pnpm-lock.yaml` in either app workspace).
- `apps/backend/pnpm-workspace.yaml`'s exclusion of `apps/backend` from the root
  workspace — deliberate.
- `.claude/launch.json` — the deliberate dev-server config; regenerating it from scratch
  has broken things before (see historical detail further down this file).
- Existing migrations under `src/modules/*/migrations/` — add a new migration, never
  edit one that may already have run.
- `lib/wishlist-storage.ts`'s stable-snapshot pattern in `getSnapshot`/`getServerSnapshot`
  — a real, previously-fixed React infinite-loop bug if simplified carelessly.
- `ProductCard`'s current layout (image → title → code → price → stock → Add to Cart) —
  a deliberate redesign, reviewed and approved; don't reintroduce the old hover-overlay
  pattern.
- Content-page slugs are a fixed, non-open-ended set (11 pages, both the storefront's
  literal route folders and the admin's hardcoded `PAGES` list in
  `content-pages/page.tsx` must be edited together — see Editable Content below).

### Completed phases (chronological, condensed — full detail in `CHANGELOG.md`)

1. **Phase 0-3**: research/IA/design system, storefront foundation, Medusa backend on
   Supabase with a real catalog (28 categories, 16 products), full technical audit.
2. **Phase 4A/4B**: real cart (drawer + full page, coupons, free-shipping progress) and
   guest checkout (Greek address form, real shipping options, order confirmation page).
3. **Phase 5**: product code (SKU)/search/add-to-cart-everywhere, real stock-awareness.
4. **Product card redesign, wishlist, PDP content sections** (`localStorage`-backed
   wishlist, no customer auth existed yet at that point).
5. **Premium Greek Checkout Phases 1-5**: Store Pickup, billing/tax documents (ΑΦΜ/ΔΟΥ),
   Google Places autocomplete, ΓΕΜΗ business lookup, SendGrid order-confirmation emails.
6. **New Arrivals / infinite scroll / homepage carousels.**
7. **"Admin-first platform"** (11 phases, A–K) — the 10 custom modules above, making
   nearly everything content-related admin-editable with zero code changes.
8. **2026-08-12, this session, in order** (see `CHANGELOG.md` for full detail on each):
   a. Supabase RLS lockdown — all 152 public-schema tables, verified live.
   b. Vercel build-crash fix (`sitemap.ts` degrading gracefully) + a real hardcoded-
      placeholder-domain SEO bug fix (`site-config.ts`).
   c. Railway + Vercel deployment prep (`railway.json`, `DEPLOYMENT.md`) — **config
      only, nothing deployed**.
   d. Full technical audit (Opus 5) — 3 real bugs fixed: a checkout-blocking cart-drawer
      bug, a dead search-sort control, unescaped HTML (XSS risk) in order-confirmation
      emails.
   e. Mobile account/wishlist nav entry points, 5 new content-page routes (11 total),
      content drafts (`CONTENT_DRAFTS.md`, not yet published).
   f. Real Content-Security-Policy with per-request nonces (`src/proxy.ts`).
   g. **Full customer authentication system** — register/login/logout/forgot-reset-
      password + a protected dashboard (profile, addresses, orders, change password).
      `/logariasmos` never 404s now.
   h. A further full audit pass (see this file's own "Known issues" section below and
      `CHANGELOG.md`'s newest entry for what it found).

### Current features — verified working, not aspirational

- **Homepage**: hero, category grid, two touch-friendly product carousels
  (Προτεινόμενα/Νέες αφίξεις), editorial banner, trust strip, newsletter form (UI only —
  see Known Issues), admin-editable announcement bar and promo banner.
- **Header**: sticky, mega menu (desktop), mobile hamburger drawer (categories +
  wishlist/account quick links, added this session), live search dropdown (debounced,
  matches product name or SKU), cart icon with live count/total.
- **Footer**: real category links, 11 content-page links (all routed, most awaiting
  published content — see Editable Content), admin-editable contact info/social links.
- **Search**: `/anazitisi` — Medusa's own `q` full-text search (name + SKU), no fuzzy
  matching (acceptable at today's catalog size).
- **Category/subcategory pages**: real products, sort, infinite scroll with a
  `<noscript>` pagination fallback, breadcrumbs with JSON-LD.
- **Product detail pages**: real price/stock/variant picker, wishlist heart, related +
  recently-viewed rails, Description/Characteristics sections (render nothing until real
  spec data exists — no fabricated content), Product JSON-LD.
- **Cart**: drawer + full page, quantity steppers, coupons, real Υποσύνολο/Έκπτωση/
  Μεταφορικά/Σύνολο breakdown, cookie-persisted.
- **Checkout**: real guest checkout, Greek address form, live shipping options, one real
  payment method (`pp_system_default`, shown as "Αντικαταβολή" — no card processor yet),
  order confirmation page.
- **Wishlist**: `localStorage`-backed (`/lista-epithymion`), heart icon on every product
  card + PDP. **Not yet synced to customer accounts** (see Known Issues).
- **Customer accounts** (new this session): register, login, logout, forgot/reset
  password (real email, degrades gracefully without a configured SendGrid key),
  protected dashboard at `/logariasmos` — profile edit, address book (full CRUD), order
  history (reuses the guest order-confirmation page as the detail view), change
  password. **Not yet integrated with cart/checkout** (no guest-cart merge on login, no
  address auto-fill at checkout — deliberately out of scope this round, real follow-up).
- **SEO**: per-page metadata, JSON-LD (Organization/Product/BreadcrumbList), dynamic
  sitemap.xml and robots.txt, canonical URLs. `siteUrl` resolves via
  `NEXT_PUBLIC_SITE_URL` → Vercel's auto-provided `VERCEL_URL` → a placeholder for local
  dev only (fixed this session — was hardcoded to the unregistered `stia.gr`).
- **Security**: real CSP with per-request nonces (`src/proxy.ts`, this session), Supabase
  RLS locked down on all 152 tables (this session), baseline security headers, httpOnly
  session/cart cookies.
- **Admin dashboard** (`localhost:9000/app`): manages products/categories/orders (native
  Medusa) plus all 10 custom modules above (SEO, content pages, homepage CMS, site
  settings, search synonyms, media library — URL-based only, promo banners, campaigns,
  analytics/consent config, store pickup).

### Important implementation details — key files

- `apps/storefront/src/app/layout.tsx` — RootLayout; fetches nav/cart/settings, reads
  the CSP nonce, mounts cart/wishlist providers and analytics/consent scripts.
- `apps/storefront/src/proxy.ts` — the real CSP (renamed from `middleware.ts` in this
  Next version). Generates a per-request nonce; if a new third-party script/embed is
  ever added, its domain must be added here or it will be silently blocked.
- `apps/storefront/src/lib/medusa.ts` — the entire Store API client (`medusaFetch`) +
  every raw Medusa response type. `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` is required or
  every call throws `MedusaConfigError`.
- `apps/storefront/src/lib/data/*.ts` / `lib/actions/*.ts` — one file pair per domain
  (cart, checkout, customer, products, categories, content-pages, etc.) — `data/` for
  reads (Server-Component-safe, never throw), `actions/` for Server Action mutations.
- `apps/storefront/src/lib/data/customer.ts` / `lib/actions/customer.ts` — the auth
  system's data/action layer. Session: `_medusa_jwt` httpOnly cookie, same pattern as
  the cart's `cart_id` cookie.
- `apps/storefront/src/app/logariasmos/(auth)/*` and `(dashboard)/*` — route groups;
  `(auth)` redirects to the dashboard if already logged in, `(dashboard)`'s `layout.tsx`
  redirects to login if not.
- `apps/backend/apps/backend/src/api/store/customers/me/password/route.ts` +
  `src/workflows/auth/change-customer-password.ts` — custom change-password endpoint;
  Medusa's own core `/auth/customer/emailpass/update` is reset-token-only and rejects a
  normal session token (confirmed by reading its middleware source).
- `apps/backend/apps/backend/src/subscribers/auth-password-reset.ts` +
  `src/utils/reset-password-email.ts` — the password-reset email, same
  degrade-gracefully-without-SendGrid pattern as `subscribers/order-placed.ts`.
- `apps/backend/apps/backend/src/admin/routes/content-pages/page.tsx` — the admin's
  hardcoded 11-slug content-page editor; adding a 12th page needs an entry here **and**
  a matching storefront route folder **and** a `sitemap.ts` entry — three places kept in
  lockstep by hand, not open-ended CRUD (deliberate, see the file's own comment).
- `apps/backend/railway.json` + `DEPLOYMENT.md` — the (unused-so-far) Railway deployment
  config and full runbook.

### Editable content — what the store owner can already change without code

Via Medusa Admin (`localhost:9000/app` in dev):
- Products: title, description, price, images (URL-based), SKU, inventory/stock,
  categories, collections, tags, material/weight/dimensions/origin-country.
- Categories and their SEO overrides.
- Homepage sections (hero, promo banner, blocks) — Homepage CMS module.
- Site settings: announcement bar text, contact info, social links, cart/checkout
  marketing copy, free-shipping messaging.
- Content pages (11 fixed slugs — About/Shipping/Returns/Privacy/Terms/FAQ/Order-
  tracking/Contact/Buying-guides/Careers/Cookies) — title + plain-text body +
  publish toggle. **All 11 currently unpublished** — draft copy is sitting in
  `CONTENT_DRAFTS.md` waiting for the owner to paste in and review.
- Search synonyms, promo banners, campaigns, analytics/consent provider IDs
  (GA4/GTM/Meta Pixel/Clarity — all optional).

**Cannot be changed without code** (by design — these are structural, not content):
- Anything about the cart/checkout/account flow logic itself.
- Adding a 12th content-page slug (needs the three-place edit described above).
- Payment methods (one exists: `pp_system_default`/"Αντικαταβολή" — a real card
  processor, Stripe, is decided but on hold pending real API keys from the owner).
- The CSP allowlist (`src/proxy.ts`) if a new third-party script is ever added.
- Customer-account features beyond what's built (no saved-payment-methods, no
  social login, no server-side wishlist sync).

### Deployment status — read this carefully, it's easy to get wrong

**Nothing is deployed to production anywhere.** This app has never been live.
- **Railway (backend)**: the user created a Railway project and clicked Deploy once
  during this session, but **deployment was explicitly postponed by the user's own
  instruction** partway through troubleshooting it — do not assume Railway is live or
  is "production." `apps/backend/railway.json` and `DEPLOYMENT.md` are prepared and
  committed; whether Railway actually has a live, working deployment right now is
  **unknown to this file** and must be asked about, not assumed, at the start of any
  future session.
- **Vercel (storefront)**: connected, Root Directory now correctly set to
  `apps/storefront` (was initially unset/wrong — caused a real "No Output Directory
  named public" build failure, fixed by the user in Vercel's dashboard), and the build
  itself now succeeds. **But the deployed site crashes on every single page** — verified
  live against `https://eshop7777.vercel.app`: React error #441 ("An error occurred in
  the Server Components render"), because `RootLayout` fetches nav/cart/site-settings
  from Medusa on every request and **there is still no live, publicly-reachable Medusa
  backend anywhere** (confirmed directly with the user — Railway remains postponed).
  This is expected, not a new bug: the build-time fix (`sitemap.ts` degrading gracefully)
  only ever addressed the build failing; it never claimed runtime would work without a
  real backend. **Do not attempt to "fix" this in code** — it resolves itself the moment
  Railway (or any other Medusa host) is actually deployed and
  `NEXT_PUBLIC_MEDUSA_BACKEND_URL` in Vercel points at it.
- **Supabase**: the only piece that's "real" in the sense of holding real data — the
  same database has been used throughout local development and is what any future
  deployment would connect to. RLS is locked down (see Security below).
- **Before assuming any deployment state, ask the user directly** — this status changes
  outside of Claude Code sessions (the user clicking around in Railway's/Vercel's own
  dashboards) and this file cannot track that in real time.

### Security

- **Supabase RLS**: all 152 tables in the `public` schema have RLS enabled with zero
  policies (full lockdown) — verified live via direct SQL query this session. Correct
  for this architecture specifically because no `supabase-js`/PostgREST client exists
  anywhere (confirmed by full-codebase grep) — nothing is meant to reach these tables
  via Supabase's Data API. Medusa's own connection role (`postgres`) has `BYPASSRLS`, so
  this has zero effect on the app. If a genuinely new Supabase-direct client is ever
  added (unlikely given the architecture), this would need real per-table policies
  instead of a blanket lockdown.
- **CSP**: real, nonce-based, `strict-dynamic` (`src/proxy.ts`), `style-src` deliberately
  split into an attribute branch (`'unsafe-inline'` — a CSP nonce can never whitelist a
  `style="…"` attribute, only a `<style>`/`<link>` element) and a `style-src-elem` branch
  (the strict nonce). **First implementation missed this and shipped a CSP that silently
  blocked every inline `style={{...}}` prop in production** (dev's `'unsafe-inline'`
  masked it — the original "verified live, zero violations" claim was only ever checked
  against `next dev`) — found by a later audit pass testing an actual production build,
  fixed same day. Lesson for any future CSP change: **verify against `next build` +
  `next start`, not just `next dev`.** Every page was already dynamically rendered
  (cart's `cookies()` usage), so nonce-based CSP cost nothing in static-generation terms.
- **Authentication**: Medusa's built-in `emailpass` customer auth provider, httpOnly JWT
  session cookie. Passwords never touch the storefront in plaintext beyond the request
  itself; change-password re-verifies the current password server-side before allowing
  a change.
- **CORS**: `STORE_CORS`/`ADMIN_CORS`/`AUTH_CORS` are all env-driven in
  `medusa-config.ts`, currently set to localhost values for dev. **Must be updated to
  the real Vercel + Railway URLs once both are actually deployed** — see
  `DEPLOYMENT.md`.
- **Secrets**: `JWT_SECRET`/`COOKIE_SECRET`/`DATABASE_URL`/`AUTH_MFA_ENCRYPTION_KEY` live
  only in gitignored `.env` files, never committed. Two fresh production secrets
  (`JWT_SECRET`/`COOKIE_SECRET`) were generated during deployment prep and handed to the
  user directly in chat, never written to a file.
- **Known limitation**: no rate-limiting on login/register/password-reset endpoints
  (Medusa's own defaults, not customized) — acceptable at pre-launch scale, worth
  revisiting before real traffic.

### SEO

**Implemented**: per-page `generateMetadata`, canonical URLs (page-aware for
pagination), JSON-LD (Organization sitewide, Product on PDPs, BreadcrumbList on
listings), dynamic `sitemap.xml` (degrades gracefully if the backend is unreachable at
build time) and `robots.txt`, Open Graph tags, admin-editable per-product/category SEO
overrides.

**Still missing/known gaps**:
- Real product photography (placeholder tiles everywhere) — no image alt-text problem
  exists yet because there are no real images, but this becomes relevant the moment
  real photos are uploaded.
- `Organization.logo` in JSON-LD — no real brand asset exists.
- Favicon is still Next.js's own default.
- No structured data beyond Organization/Product/BreadcrumbList (no Review/AggregateRating
  — correctly absent, since no real review system exists; adding fake ratings was
  explicitly rejected earlier in this project's history).

### Performance

**Implemented**: Next/Image via a dynamic `remotePatterns` list (derives the production
backend host automatically), server-rendered data fetching (no client-side waterfalls
for initial page data), infinite-scroll listings with a real `<noscript>` fallback
instead of client-only pagination, `next/font` self-hosting (no external font CDN
calls).

**Known risks, never measured**: no Lighthoude/axe run has ever been performed — all
Core Web Vitals work so far is structural (flattened request waterfalls, no
layout-shifting images since there are no real images yet), not measured against real
numbers. Worth doing once real product photography exists (image weight will be the
first real CWV variable).

### Known issues

See `TASKS.md` for the full, longer-running list (payment processor, footer content
pages, etc.). Specific to review before/after the newest audit pass:
- **Guest-cart merge on login, server-side wishlist sync for logged-in customers, and
  checkout auto-fill from a saved address were deliberately not built** in this
  session's auth system — real, expected follow-ups, not bugs.
- **The newsletter form does nothing** (validates, then silently no-ops) — needs a real
  email-provider decision, flagged since the original production audit, deliberately
  not invented.
- **`PaymentSection`'s multi-provider UI is structurally broken** but harmless today
  (exactly one payment provider exists) — needs a real fix alongside the first real
  payment processor (Stripe, decided, on hold for real API keys).
- **11 content pages are all unpublished** — drafts exist (`CONTENT_DRAFTS.md`), need
  the owner to review and publish via Admin.
- **No `not-found.tsx`/`error.tsx` exists anywhere in the app** — confirmed live: any
  404 (e.g. any of the 11 unpublished content pages, or a mistyped URL) shows Next's
  bare English "This page could not be found" with no header/footer/nav. Real, if minor,
  UX/brand gap for a Greek-language store — content/design work, not a bug fix, roughly
  a 15-minute build whenever prioritized.
- **`registerAction` (`lib/actions/customer.ts`) has an unrecovered partial-failure
  window** between its three sequential Medusa calls (register auth identity → create
  customer → refresh token). If the customer-creation call fails after the auth identity
  was already created, the affected email is left in a broken state: a second
  registration attempt says "already exists," but logging in succeeds at the auth layer
  (sets the session cookie) and then `getCustomer()` 404s, so the `(dashboard)` layout
  bounces back to login — an unexplained, silent login loop for that one email, no error
  shown anywhere. Rare (only happens if step 2 specifically fails), but permanent for
  whoever hits it until manually fixed in the database. Needs a real compensating-action
  design (delete/retry the orphaned auth identity), not a blind patch — flagged, not
  fixed.
- **`/logariasmos/nea-kodikos` (the password-reset-confirm page) sits inside the
  `(auth)` route group**, whose layout redirects to the dashboard if already logged in.
  Real scenario: a visitor requests a password reset on desktop while already signed in
  on their phone, opens the emailed link on the phone, and gets silently redirected to
  the dashboard instead of being able to set a new password. Needs moving that one page
  out of the `(auth)` group (or excepting it from the redirect) — not done because it's
  a routing structure change that wants live re-verification, not a same-audit blind fix.
- **CSP's `img-src 'self'` will block any admin-configured hero image the moment one is
  set**, since the Media Library is deliberately URL-based (Phase I) and a hero image
  set to an off-origin URL renders as a CSS `background-image`, bypassing `next/image`'s
  own domain allowlisting entirely. Not observable today (no hero image is published).
  One-line fix when it comes up: add the real image host to `src/proxy.ts`'s `img-src`.
- **No `og:image`/`twitter:image` anywhere** despite `twitter:card: summary_large_image`
  — social shares render as bare link cards. Root cause is the same "no real product
  photography exists yet" state documented everywhere else in this file; not fabricated
  a placeholder, per this project's standing anti-fabrication rule.
- Minor, not urgent: clearing a saved address's label silently no-ops (Medusa never
  receives the clear — `JSON.stringify` drops `undefined`, and whether the field accepts
  `null` wasn't verified live); `AddressBook`'s delete has no confirmation step; the
  dashboard layout guard always redirects post-login to `/logariasmos` regardless of
  which page was originally deep-linked to (App Router layouts can't read the current
  pathname without extra plumbing through `src/proxy.ts`).

### Next recommended steps

- **P0 (critical)**: none currently open that block using the app in dev. Before any
  real production traffic: (1) confirm actual Railway/Vercel deployment status with the
  user (this file cannot know it), (2) update CORS env vars to real production URLs
  once both are deployed, (3) get a real payment processor connected (Stripe, on hold
  for the user's own API keys).
- **P1 (important)**: review and publish the 11 content-page drafts; decide the
  free-shipping threshold (currently a disabled placeholder); enter real product
  characteristics data; run axe/Lighthouse for the first time; reconcile
  `TrustStrip`/PDP payment copy (still overclaims card payment support).
  Cart/wishlist/checkout integration with the new account system (guest-cart merge,
  address auto-fill, server-side wishlist sync).
- **P2 (useful later)**: real brand assets (logo, favicon), real product photography,
  a real domain, account-area polish (order filtering/pagination if order volume grows),
  social login if ever requested.

### Important commit hashes (verified against real `git log`, not guessed)

| Commit | What it is |
|---|---|
| `68cbfdf` | Full customer authentication system (register/login/logout/forgot-reset-password + protected dashboard) |
| `45fb4f5` | Real CSP with per-request nonces via `src/proxy.ts`, JSON-LD/analytics nonce handling — verified clean `tsc`/`eslint`/build |
| `ed9e0b9` | Mobile account/wishlist nav entry points, 5 new content-page routes, content drafts |
| `a63b0f7` | Railway start-command fix (`medusa` CLI resolution via `pnpm --dir`) |
| `e1c0382` | Checkout-blocking cart-drawer bug fix, dead search-sort fix, email XSS fix (first full audit pass) |
| `f75de37` | Railway + Vercel deployment prep, hardcoded-domain SEO bug fix |
| `3109016` | Supabase RLS lockdown (152 tables) + Vercel sitemap build-crash fix |
| `50e10ad` | Admin-first platform post-implementation audit fixes |
| `f043b31` | Admin-first platform, Phase K (Analytics/Consent) — last commit of the 11-phase roadmap |

### Current priorities (as of end of this session)

In order: keep the app functionally correct and secure in dev → get real deployment
status confirmed and CORS/env vars finalized → real payment processor → content
publication → account/cart/checkout integration → measured performance/SEO polish.
This ordering is a reasonable default, not a directive — always confirm current
priorities with the user at the start of a new session rather than assuming this list
is still exactly right.

---

Everything below this point is older, more granular reference material. It hasn't been
rewritten to match the "START HERE" section above — where the two disagree on anything
dated, trust the section above and `CHANGELOG.md`.

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
    judgment call rather than silently deviating. **Superseded 2026-08-11**:
    a later session's brief asked for the same centering again; flagged the
    same trade-off again, and this time the user chose to center all three
    columns together rather than keep them right-aligned — see the cart
    price/discount alignment audit entry below for the actual current
    state (`text-center` on all three, header + rows). Don't read this
    right-aligned note as still accurate.
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

- **New Arrivals / infinite scroll / homepage carousels architecture
  (2026-08-11)** — three features, built after an explicit architecture
  review (products/categories/pagination/tags/homepage/carousel-library/SEO
  all inspected live before any code).
  - **New Arrivals membership** is a hybrid, not a single Medusa filter: a
    product counts as a new arrival if it's within a rolling 30-day
    `created_at` window (`isWithinNewArrivalWindow`, the same window that
    already drove the "Νέο" badge) **or** carries Medusa's native product
    tag `"new"` (`NEW_ARRIVAL_TAG_VALUE`, `lib/data/products.ts`) — real,
    core Medusa tags, confirmed live via `+tags.value` on the Store API and
    manageable from the Admin's product "Organize" panel, zero backend
    changes. This is the admin-controlled override the brief asked for:
    genuinely new products need no admin action, but the admin can also
    tag any product to feature it regardless of age. The "Νέο" badge
    (`toDomainProduct`'s `badges`) now reads from this same combined rule,
    not the date-only check, so a tagged product shows the badge
    consistently everywhere. **`getNewArrivalsPaged()`** fetches up to
    `NEW_ARRIVAL_CANDIDATE_LIMIT` (200) products ordered by `-created_at`,
    filters to members, then sorts/slices in-process — membership and price
    sort both aren't expressible as a single Medusa query param, so this
    follows the same "fetch a superset, finish the work in JS" pattern
    `getProductsByCategoryHandle` already used for price sort. `getFeaturedProductsPaged()`
    (backing the new "Recommended Products" page) is the equivalent for the
    old `getFeaturedProducts()` — same honest "no real bestseller signal
    exists, this is a curated slice" reasoning as before, just now
    paginated, and defaulting to alphabetical (not "newest") so it doesn't
    read as a duplicate of New Arrivals.
  - **Infinite scroll is layered on top of the existing SSR pagination, not
    a replacement for it.** `PAGE_SIZE` (12 → 24, `CategoryPLPView.tsx`) is
    one shared constant for the SSR'd first page and every client-fetched
    batch after it. `InfiniteProductGrid` (new, Client Component,
    `components/category/`) owns an `IntersectionObserver` sentinel that
    calls a small per-listing-type Server Action
    (`lib/actions/products.ts`) for the next offset/limit batch and appends
    the result client-side, deduped by product id via a `Set`. The
    listing's "identity" — category/subcategory handle, New Arrivals,
    Recommended, or a search query, plus sort, plus the SSR'd page number —
    is captured in a `resetKey` string; React's documented "adjust state
    during render" pattern (`if (state.resetKey !== resetKey) setState(...)`)
    snaps straight back to the fresh server props the instant that key
    changes, so switching sort or category never appends onto a stale
    previous listing. **The classic `Pagination` component is kept
    completely unchanged, just wrapped in a real `<noscript>`** — crawlers
    and no-JS visitors get exactly the same crawlable, independently
    canonical paginated URLs (`?page=2`, `?page=3`, …) this app already
    had; every product is also independently reachable via `sitemap.xml`
    regardless of how deep a category's pagination goes, which is why this
    was judged safe rather than needing every paginated URL enumerated in
    the sitemap too.
  - **Two real bugs found and fixed live, not just by inspection:**
    (1) `CategoryPLPView` (a Server Component) originally passed a plain
    closure (`buildPageHref`) as a prop into `InfiniteProductGrid` (a
    Client Component) — React cannot serialize a function across that
    boundary, and it surfaced immediately as a 500
    ("Functions cannot be passed directly to Client Components"). Fixed by
    passing `basePath`/`extraParams` as plain serializable data and
    building the href *inside* the Client Component instead — **any prop
    crossing a Server → Client boundary must be data, never a closure,
    a Server Action being the one exception.**
    (2) The `IntersectionObserver` sentinel only fired once on short lists
    (e.g. New Arrivals' 16 products at the old `PAGE_SIZE=4` used for
    testing): once the sentinel was within the pre-load `rootMargin` and
    the page never grew tall enough to push it back out, intersection
    state never *changed* again, so a persistent observer silently stopped
    loading after the first batch. Fixed by re-creating (not just
    re-observing) the `IntersectionObserver` after every successful batch
    (`state.products.length` added to the effect's deps) — a fresh
    `observe()` call always fires once with the *current* intersection
    state, which is the only way a short list keeps chaining loads until
    it's genuinely exhausted. **Any future `IntersectionObserver`-driven
    "load more" on a list that might not exceed one viewport must
    re-create the observer per batch, not just attach it once.**
  - **Verified live, with a real testing wrinkle worth remembering**: the
    `computer` scroll-simulation browser-automation tool did not reliably
    produce real scroll/intersection events in this environment (repeat of
    the pre-existing "browser automation click/type unreliable" note
    below) — switched to direct `window.scrollTo()` + polling via
    `javascript_tool`, which did trigger real loads and confirmed the
    feature genuinely works end-to-end: correct batch sizes, zero
    duplicate products (checked via a `Set` of product hrefs), correct
    "Είδες όλα τα προϊόντα" end state, zero extra network requests once
    exhausted (checked via `read_network_requests`), and a clean reset
    (verified product order/count) when the sort dropdown changes.
    **If a future session needs to browser-test scroll-triggered behavior
    in this environment, prefer `window.scrollTo()` via `javascript_tool`
    over the `computer` tool's scroll action.**
  - **Homepage carousels**: `ProductRail` — shared by the homepage, the
    PDP's related/recently-viewed rails, and the cart's cross-sell rail —
    converted from a static CSS grid to a native
    `overflow-x-auto` + `scroll-snap-type: x mandatory` track (no carousel
    library added; none existed in `package.json`, matching the brief's
    "prefer the lightest solution"). Desktop-only arrow buttons
    (`hidden md:flex`) reuse the existing `ChevronDownIcon` via a CSS
    rotation instead of adding new icon SVGs, `scrollBy()` the track by
    ~90% of its visible width, and track scroll position via a `scroll`
    listener to set a real `disabled` attribute at each end (not just a
    visual dim). Mobile relies entirely on the scroll-snap CSS for native
    touch/swipe — zero JS needed there. Both rails bumped from 4 → 12
    products; the "Δείτε Περισσότερα" tile is a real track item (same
    width as a card) linking to the corresponding full listing page.
    `ProductCard` itself was not touched — the carousel only changes its
    container, per the brief's explicit "do not create a second product
    card design."

- **Cart price/discount alignment audit, verified against a real sale
  (2026-08-11)** — a request to audit the mini-cart/main-cart SKU, pricing,
  and discount presentation. Inspection found the entire feature set
  (SKU, original+current price with strikethrough, discount badge, one
  shared `discountPercent()` in `lib/format.ts` used by both
  `CartLineItemRow` and `CartLineItemTableRow`) already existed from the
  prior session referenced above — nothing was rebuilt or duplicated. The
  only real gap: the desktop table's `ΑΡΧΙΚΗ ΤΙΜΗ`/`ΤΙΜΗ`/`ΣΥΝΟΛΟ` columns
  were right-aligned by a previous deliberate decision (see that entry
  above); this session's brief asked for centering again, the trade-off
  was re-flagged, and the user chose to center all three together —
  `CartTableHeader.tsx` and `CartLineItemTableRow.tsx` now use
  `text-center`/`items-center` for those three columns instead of
  `text-right`/`items-end`.
  - **Why nothing was visible live before this**: the real catalog had
    zero active promotions (`calculated_amount === original_amount` on
    every one of the 16 real products, confirmed via a direct Store API
    check) — `item.compareAtUnitPrice` was correctly always `undefined`,
    so the strikethrough/badge had nothing to render. Not a bug; the
    honest empty state this codebase always prefers over a fabricated one.
  - **Verified against a real Medusa sale price list the user created live**
    (Αντικολλητικό Τηγάνι 28cm, €39.90 → €31.92): `discountPercent()`
    computed exactly 20% from Medusa's real `calculated_price`; a mixed
    cart (2 regular + 1 discounted) summed correctly; the three price
    columns measured pixel-identical centers across the header and every
    row via `getBoundingClientRect()`, **including** the discounted row's
    taller two-line cell (price + badge stacked) — vertical center matched
    the row's true center for every column, confirming `items-center` on
    the shared grid handles mixed-height rows correctly, not just uniform
    ones; a quantity change on the discounted line recalculated the line
    total correctly while the badge stayed a per-unit percentage (didn't
    scale with quantity, correct); mini-cart drawer matched the main page
    exactly (impossible to drift — one shared calculation); mobile (375px)
    showed the full hierarchy with zero horizontal overflow; adding the
    item did not auto-open the drawer (pre-existing behavior, untouched).
  - **Resetting a forgotten local admin password, same session**: no
    admin password was ever recorded for this project (by design), and
    `medusa user -e <email> -p <password>` only *creates* users — it
    errors ("already exists") on an existing email, it does not reset one.
    The correct fix, consistent with this backend's own AGENTS.md
    ("writing raw SQL or importing DB clients directly" is listed as a
    common mistake): a one-off `medusa exec <script>` script that resolves
    `Modules.AUTH` from the container and calls
    `authModuleService.updateProvider("emailpass", { entity_id, password })`
    — the exact same code path `@medusajs/auth-emailpass`'s
    `EmailPassAuthService.update()` uses internally, so the password is
    hashed the same way Medusa hashes it at runtime. No raw SQL, no
    reimplemented crypto. **The `medusa` CLI's cold start took ~100-150s
    on this machine** — a command that appears to hang at a 45-60s timeout
    may just need longer, not be stuck; confirmed by testing `medusa
    --version` alone, which took the same ~100s before returning a normal
    result.

- **Full technical audit, no new feature (2026-08-11)** — a whole-codebase
  bug/dead-code/performance/SEO/architecture pass. Found one real, live bug:
  `globals.css` sets `scroll-behavior: smooth` on `html`, but Next.js 16
  needs an explicit `data-scroll-behavior="smooth"` attribute on the
  `<html>` tag to know it can temporarily disable smooth scrolling during
  route transitions — without it, every client-side `<Link>` navigation
  sitewide did an animated scroll-to-top instead of an instant one. Fixed
  in `RootLayout`'s `<html>` tag (`app/layout.tsx`). **If this project's
  `globals.css` ever changes `scroll-behavior` again, or a new root layout
  is ever introduced, keep this attribute in sync with it** — Next 16
  warns about it live in dev but the fix is easy to forget since it's not
  a TypeScript/ESLint-caught class of bug. Everything else audited clean:
  no orphaned files (verified via a cross-reference script, not
  assumption), no duplicate pricing/discount/formatting logic, no direct
  Supabase/Postgres access anywhere in the storefront (architecture
  intact), correct metadata/canonical/JSON-LD/sitemap/robots.txt on every
  page type. See `CHANGELOG.md` for the full list of what was checked and
  deliberately left alone (font-preload dev warnings, `ProductCard`
  hydration cost, dormant `next/image priority` — all previously
  identified or currently zero-impact, not re-litigated or spuriously
  "fixed").

- **Admin-first platform, Phase A: Product SEO (2026-08-11)** — first phase
  of a much larger initiative to make the store manageable from the Medusa
  Admin without code changes (see `TASKS.md` for the ~11-phase roadmap,
  `ADMIN_GUIDE.md` for the end-user-facing reference). Architecture review
  done live before any code: Medusa 2.18.0, no admin extensions or
  data-holding custom modules existed yet, confirmed the real widget
  injection zone list from `@medusajs/admin-shared`'s bundled types rather
  than guessing at zone names.
  - **New `seo` module** (`apps/backend/src/modules/seo`) — a single
    polymorphic model (`resource_type: "product"|"category"|"homepage"` +
    `resource_id` + the SEO fields) rather than one model/Module Link per
    entity type. Deliberate: homepage SEO has no underlying Medusa entity
    to link against at all, so a Module Link per entity couldn't cover all
    three uniformly, and a single shared model avoids the exact
    "duplicate the field set three times" the project's own principles
    warn against. New `seo` table, real additive-only migration applied to
    the live Supabase database via `medusa db:generate`/`db:migrate`.
  - **Admin**: new SEO widget on the product detail page
    (`product.details.side.after` injection zone — confirmed real/stable
    by reading `@medusajs/admin-shared`'s `INJECTION_ZONES` list directly,
    not assumed), dedicated fields (SEO Title, Meta Description, Canonical
    URL, OG Title/Description, Social Image URL, Keywords, Robots).
    Reads/writes through shared `/admin/seo` and `/store/seo` routes (one
    route per side, reused across every resource type via
    `resource_type`/`resource_id`, not one route per entity).
  - **The mutation goes through a real workflow**
    (`upsertSeoWorkflow`/`upsert-seo` step), not a direct service call from
    the route handler — Medusa's own
    `@medusajs/no-service-mutations-in-api-route` ESLint rule caught the
    first draft calling the module service directly in the POST handler;
    fixed by moving the list-then-create-or-update logic into a workflow
    step, matching this backend's own AGENTS.md convention ("business
    logic belongs in workflows, not route handlers").
  - **Storefront**: `lib/data/seo.ts`'s `getSeoOverride()` — never throws,
    returns `null` on any failure so a missing/unreachable SEO record can
    never break the page it's decorating (same defensive pattern as every
    other "admin left this empty" case in this codebase). Wired into the
    PDP's `generateMetadata` and Product JSON-LD; the structured-data
    override field merges on top of the existing generated JSON-LD
    (`...productJsonLd, ...seo?.structuredDataOverride`) rather than
    replacing it wholesale, so a partial override (e.g. just `brand`)
    doesn't silently drop `sku`/`offers`/`material`.
  - **Two real bugs found and fixed live**, both worth remembering for any
    future custom Medusa module:
    1. **`MedusaService`'s generated TypeScript types can be wrong for the
       runtime methods they claim to describe.** For a model named `"seo"`,
       the generated *types* pluralize it as `Seoes` (hero/heroes-style —
       `listSeoes`/`createSeoes`/`updateSeoes`), and `tsc --noEmit` not
       only accepted this, it actively suggested `listSeoes` as the "did
       you mean" fix when the correct name was used. The *actual*
       runtime-generated methods — confirmed by writing a one-off
       `medusa exec` script that resolves the real service and inspects
       `Object.getOwnPropertyNames` up its prototype chain, the same
       ground-truth technique already used earlier in this project for
       the CLI/password investigation — are `listSeos`/`createSeos`/
       `updateSeos`, a plain "+s". `tsc` was clean while the real route
       500'd (`seoModuleService.listSeoes is not a function`). **Fixed by
       defining an explicit `SeoServiceMethods` interface matching the
       verified real shape and resolving the module against it**
       (`container.resolve<SeoServiceMethods>(SEO_MODULE)`) instead of
       trusting the class's auto-generated type for this model. **If a
       future custom module hits the same class of bug (an irregular
       model name where compile-time and runtime pluralization diverge),
       verify the real method names via `medusa exec` before trusting
       `tsc`** — a clean `tsc --noEmit` is not proof the code will run.
    2. **Root layout's title template collided with an admin-entered SEO
       Title.** `RootLayout`'s `title: { template: "%s | STIA" }` applies
       to every plain-string page title — correct for the generated
       default, but an admin who types a full custom SEO Title (which may
       itself already end in "- STIA") got it doubled:
       "... - STIA | STIA". Fixed with Next's `title: { absolute: ... }`
       specifically for the admin-override branch (opts out of the parent
       template for that one page), while the generated-default branch is
       untouched and still correctly gets the site suffix. **Any future
       admin-editable title field (category SEO, homepage SEO) needs the
       same `title.absolute` treatment, not a plain string.**
  - **Verified live against the real Supabase database, full round trip**:
    set a real title/description on a real product via the widget,
    confirmed the POST persisted past a reload (not just optimistic
    client state), confirmed the storefront's `<title>`/meta
    description/canonical picked it up (including the template-collision
    fix), set `robots: noindex` and confirmed the real
    `<meta name="robots" content="noindex, follow">` tag appeared,
    confirmed an *untouched* product's page is completely unaffected
    (fallback path doesn't regress anything), then reset the test
    product's fields back to empty. `tsc`/`eslint`/`next build`
    (storefront) and `medusa lint`/`tsc`/a full `medusa build` (backend,
    including the admin Vite bundle) all clean.
  - **Known, honestly-scoped gap**: the Structured Data Override field has
    no form input in the widget yet — the model field and storefront
    merge logic both exist and work if set directly via the API, but
    there's no admin UI for it. Deferred as the single rarest-need field
    of the eight; a small follow-up, not forgotten.
  - **Testing note for this environment**: the browser tool's console-log
    buffer does not clear on same-tab navigation (already noted elsewhere
    in this file) — when debugging a live fix, open a fresh tab or check
    `read_network_requests` (status codes, not the stale console) to
    confirm current behavior. Also: `medusa exec`/`medusa lint`/`medusa
    db:generate`/`db:migrate` all share the CLI's ~100-150s cold start
    already documented below — budget for it rather than assuming a
    45-60s timeout means the command hung.

- **Admin-first platform, Phase B: Category SEO + Homepage SEO
  (2026-08-11)** — reused Phase A's `seo` module/routes/workflow entirely
  unchanged; the model already supported `resource_type:
  "category"|"homepage"` from Phase A's own design, so this phase needed
  zero migration.
  - **Admin**: Phase A's product widget form was extracted into a shared
    `src/admin/components/seo-form.tsx` (`SeoForm`) instead of copy-pasting
    it a second time — the product widget is now a thin wrapper around it.
    New **Category SEO** widget on the category detail page
    (`product_category.details.side.after` zone — confirmed real via
    `@medusajs/admin-shared`'s `INJECTION_ZONES`, same verification
    discipline as Phase A's product zone). Homepage SEO has no underlying
    Medusa entity to hang a widget zone off, so it's a genuine standalone
    admin route instead: `src/admin/routes/seo-homepage/page.tsx`
    (`defineRouteConfig`, appears in the sidebar as "SEO Αρχικής"),
    rendering the same `SeoForm` with `resourceId: "homepage"` — the
    singleton resource_id Phase A deliberately chose specifically so this
    would be possible later without a real entity to link against.
  - **Storefront**: `getSeoOverride("category", category.id)` wired into
    both `[category]/page.tsx` and `[category]/[subcategory]/page.tsx`'s
    `generateMetadata`, same fallback + `title.absolute` pattern as the
    PDP (see Phase A's bug #2 above for why `.absolute` matters). **One
    genuinely new piece of logic, not just a copy of the product
    pattern**: the canonical-URL override only applies on page 1 of a
    paginated category listing — `?page=2` and beyond always keep
    self-canonicalising to their own URL (`canonicalListingPath`)
    regardless of what's set in the admin field. Applying an admin
    canonical override to every paginated page would tell Google every
    page is a duplicate of page 1, undoing the pagination SEO this project
    already built (see `lib/search-params.ts`'s `canonicalListingPath`
    comment). Verified live: set a canonical override on the real
    "Κουζίνα" category, confirmed page 1 uses it and `?page=2` ignores it.
  - **Homepage**: `app/page.tsx` had no `generateMetadata` at all before
    this phase — all its metadata came from `RootLayout`'s static export.
    Added one, reading `getSeoOverride("homepage", "homepage")` with
    fallback to two new constants in `lib/site-config.ts`
    (`siteDefaultTitle`, `siteDefaultDescription`) rather than duplicating
    the Greek copy that was already hardcoded inline in `RootLayout`;
    `RootLayout` was updated to read from the same constants instead of
    its own inline strings, so the two can't drift apart.
  - **Verified live against the real Supabase database, full round
    trip**: set a real title/description on the real "Κουζίνα" category
    via the widget, confirmed the storefront category page's
    `<title>`/description picked it up with no template doubling; set a
    canonical override and confirmed the page-1-only gating above; set and
    then cleared a real homepage title/description via the new route,
    confirmed the storefront homepage picked up the override and then
    correctly fell back to `RootLayout`'s defaults once cleared (waited
    out `/store/seo`'s 30s `revalidate` window rather than assuming an
    immediate reload would show it — same class of caching gotcha as
    `next: { revalidate: 30 }` anywhere else in this codebase). No
    console/server errors observed at any point. `medusa lint`, `tsc
    --noEmit` (storefront, and the backend admin's own `tsconfig.json`), a
    full `next build`, and a full `medusa build` (backend + the admin Vite
    bundle) all clean.
  - **Housekeeping**: verifying this phase needed another temporary admin
    user, `qa-agent4@stia.gr` (no admin password exists for this project
    by design — see Phase A above and "Environment setup" below), same
    pattern as `test-agent@stia.gr`/`qa-agent@stia.gr`/`qa-agent2@stia.gr`/
    `qa-agent3@stia.gr`. Left in place, harmless, same "cleanup whenever
    convenient" status as the others.

- **Admin-first platform, Phase C: Site Settings (2026-08-11)** — footer
  contact info, business hours, social links, and the announcement bar
  made admin-editable. First phase needing a genuinely new backend module
  rather than reusing Phase A's `seo` module: site settings are a single
  global object, not a per-resource record, so `resource_type`/
  `resource_id` doesn't fit.
  - **New `site-settings` module** — a true singleton, model name
    deliberately singular (`site_setting`) so "setting" → "settings"
    pluralizes by the regular rule, avoiding Phase A's `Seo`→`Seoes`
    mismatch class of bug for a *different* reason than Phase A's fix
    (there, an explicit interface override was needed; here, picking a
    regular-plural model name avoided needing one at all). Verified the
    real runtime method names via `medusa exec` anyway before trusting
    the generated types — they matched this time, but the verification
    step is now standard practice for any new custom module in this
    project, not a one-off from Phase A.
  - **Admin**: standalone `Ρυθμίσεις Καταστήματος` route (no widget zone
    fits a global singleton, same reasoning as Phase B's homepage SEO
    route), four sections (Announcement Bar, Footer, Contact Details,
    Social Networks).
  - **Storefront**: `AnnouncementBar` takes admin text as a prop, renders
    `null` when empty — the component's prior hardcoded copy was itself a
    stand-in left over from removing a free-shipping claim that wasn't
    backed by a real shipping rule, so there was nothing genuine for it to
    keep saying by default. `Footer` gained a contact block (real
    `tel:`/`mailto:` links) and social icons, both showing only populated
    fields. Added `FacebookIcon`/`InstagramIcon`/`TikTokIcon` to the
    shared `Icons.tsx` rather than adding an icon-library dependency for
    three icons.
  - **A real, live-verified caching bug found and root-caused, distinct
    from a data bug**: after clearing test data in the admin, the
    storefront kept showing the old value for minutes. A direct `curl`
    against the Medusa backend (port 9000, bypassing Next.js) proved the
    database was already correctly empty — so this was never a lost-write
    problem. Root cause: Next's `fetch(..., { next: { revalidate: N } })`
    persists to `apps/storefront/.next/cache/fetch-cache/` **on disk**,
    and that directory **survives `next dev` restarts** — files from a
    session two days earlier were still sitting there. This machine's
    Windows/Turbopack setup already has a known-flaky write path against
    that exact directory (`next build` prints `Failed to update prerender
    cache ... UNKNOWN` warnings on every run — see `NEXT_STEPS.md`'s
    "Turbopack dev-server HMR goes stale" warning for the related, more
    general symptom), which plausibly
    explains why an entry got stuck instead of revalidating on its normal
    30-60s schedule. **Fixed by deleting `.next/cache` and restarting the
    dev server** — no code was wrong. **For any future session where an
    admin-editable value "isn't showing up" on the storefront: check the
    database directly via `curl` first** (proves whether it's a save bug
    or a cache bug) **before touching application code** — this session
    nearly went down the wrong path (re-editing the save logic) before
    doing exactly that check.
  - **A genuine browser-automation false-positive, worth remembering for
    future verification work**: a first attempt to clear the Site
    Settings form appeared to succeed (fields looked filled with the
    intended new values, save button was clicked, a screenshot was taken)
    but a backend `curl` check immediately after showed the *old* values
    still present with an unchanged `updated_at`. The actual bug: the
    `read_page` tool's synthesized "textbox" label **echoes the input's
    `placeholder` attribute regardless of the field's real current
    value**, for any field that has one — so a field that still visually
    contains old text can misleadingly read as empty in `read_page`
    output. **Verify a form field's true content via `computer` screenshot
    (not `read_page`'s textbox label) before trusting that a clear/edit
    actually took**, especially right before a save action whose result
    will be asserted against a real backend.
  - **Verified live against the real Supabase database, full round
    trip**: set real values across all four sections, confirmed the
    storefront's announcement bar/footer contact links/social icons all
    picked them up; cleared every field (second attempt, after catching
    the false-positive above) and confirmed the correct empty-state
    fallback on the storefront, past the disk-cache issue. `medusa lint`,
    `tsc --noEmit` (storefront + backend admin), a full `next build`, and
    a full `medusa build` all clean.

- **Admin-first platform, Phase D: Content Pages (2026-08-11)** — About,
  Shipping, Returns, Privacy, Terms, FAQ, all admin-editable instead of
  404ing (the Footer already linked to `/sxetika`, `/apostoles`, etc. from
  earlier sessions; none of those routes existed until this phase).
  - **New `content-pages` module** — `slug`/`title`/`body`/`is_published`,
    unique index on `slug`, `is_published` defaults `false`. Deliberately
    a *fixed* six-slug set, not an open-ended CMS: the storefront has one
    literal route folder per slug, not a dynamic `[slug]` route, so
    nothing prevents an admin from creating a page with no storefront
    route to render it — the fixed set is what keeps admin and storefront
    in lockstep. Real migration applied live; real runtime method names
    verified via `medusa exec` before trusting the generated types (now
    standing practice for every new module) — no mismatch this time,
    following the same regular-plural-friendly singular model name
    discipline as Phase C's `site_setting`.
  - **Admin architecture deliberately avoids a nested dynamic route**: the
    obvious CRUD shape is a list route plus `content-pages/[id]/page.tsx`,
    but Medusa v2's admin dynamic route params
    (`useParams` from `react-router-dom`) have a documented open upstream
    bug (medusajs/medusa#9794) where the parameter isn't reliably
    captured. Built as a single route with client-side master/detail
    instead — hardcoded list of the six pages, no URL segment per page —
    which sidesteps the bug entirely and is arguably better UX for a fixed
    set this small. **If a future phase needs a genuinely open-ended list
    of admin-created items** (Homepage CMS promo blocks, Campaigns), this
    same constraint will resurface — check whether the upstream bug is
    fixed on the then-current Medusa version before assuming a nested
    dynamic route will work, or use the same master-detail-in-one-route
    pattern if the item count stays small and bounded.
  - **Storefront**: shared `ContentPageView` renders `body` as plain
    paragraphs (blank line → new paragraph, single newline → `<br/>`), no
    markdown, no `dangerouslySetInnerHTML` — deliberately not rendering
    raw HTML even though the content is trusted-owner input, since plain
    text is sufficient for every page this phase actually needs and it's
    strictly safer. `sitemap.ts` now fetches all six pages and only
    includes the ones that are published, so a draft page is never offered
    to crawlers — the same "public API/output never leaks unpublished
    content" rule as the `/store/content-pages` route itself (returns
    `null`, not the draft, for an unpublished page).
  - **Verified live against the real Supabase database, full round
    trip**: real title + multi-paragraph body on the About page,
    paragraph/line-break rendering confirmed correct on the storefront;
    unpublished page confirmed 404 and absent from the sitemap; `/store/
    content-pages` confirmed to return `null` (not draft content) for an
    unpublished page; cleared test data back to unpublished/empty and
    reconfirmed the 404. Caught the same class of browser-automation
    checkbox flakiness as Phase C (a click that visually didn't register)
    — screenshot-verified before every save this time, not assumed.
    `medusa lint`, `tsc --noEmit`, a full `next build` (19 routes total,
    including all six new ones), and a full `medusa build` all clean.

- **Admin-first platform, Phase E: Homepage CMS (2026-08-11)** — the
  roadmap's own "biggest single phase" (hero/sliders/promo blocks).
  Deliberately scoped down from a generic drag-and-drop section builder:
  made Hero and the editorial/promo section admin-managed ordered lists,
  left TrustStrip and Newsletter untouched. TrustStrip makes factual
  claims tied to real checkout/fulfillment capability — same reasoning as
  Phase C keeping the Footer's payment-methods list hardcoded, an
  admin-editable factual claim risks drifting from reality. Newsletter's
  signup isn't wired to a real provider yet (a Campaigns-phase concern).
  - **New `homepage-blocks` module** — single model with
    `kind: "hero"|"promo"` instead of two near-identical models (the field
    set is genuinely identical between a hero slide and a promo block).
    **The first genuinely open-ended list in this initiative** — every
    prior phase was either a fixed key to upsert (seo, site-settings) or a
    fixed known set (content-pages' six slugs); this one has real
    create/delete. Ordering is a typed-in numeric `sort_order`, not
    drag-and-drop — simpler, sufficient for a handful of blocks. Real
    migration applied live; real runtime method names verified via
    `medusa exec` before trusting generated types (standing practice now)
    — no mismatch.
  - **Admin**: one route, two client-side list sections with inline
    add/edit/delete, extending Phase D's no-nested-route precedent
    (avoiding medusajs/medusa#9794) to a genuinely open-ended list.
    `@medusajs/icons` isn't a direct dependency of this app (same
    situation as `@medusajs/types` in Phase A) — delete is a plain text
    button, not an icon, to avoid adding an untracked dependency for one
    icon.
  - **Storefront**: `Hero` falls back to the store's original hardcoded
    copy at zero published slides, renders statically at one, and becomes
    a real swipeable carousel at two or more — reusing `ProductRail`'s
    exact native CSS scroll-snap pattern (no carousel library) rather than
    inventing a second interaction pattern for the same problem.
    `EditorialBanner` renders one or more promo blocks in `sort_order`,
    alternating image side, falling back to its original hardcoded promo
    when none are published.
  - **A real bug found and fixed live**: a second hero slide that
    deliberately left its eyebrow blank rendered the *original default*
    eyebrow text ("Νέα Συλλογή") instead of nothing. Cause:
    `content?.eyebrow ?? "Νέα Συλλογή"`-style per-field fallbacks are
    correct semantics for "no admin content exists at all" but wrong for
    "this one real slide has one blank field" — a blank field on real
    content must render as absent, never silently borrow an unrelated
    default's copy. Fixed by switching to the whole-object fallback
    pattern `EditorialBanner`'s `DEFAULT_BLOCK` already used correctly:
    choose *either* a single default object *or* a real slide, never mix
    fields from both. **Any future admin-content component with a
    zero/one/many rendering split needs this same whole-object (not
    per-field) fallback rule** — caught here only because the carousel was
    actually clicked through slide-by-slide during verification, not just
    checked on slide 1.
  - **Two real browser-automation false-positives, both resolved by
    checking the backend directly rather than trusting the tool's own
    success signal**: (1) a carousel dot click did nothing in one browser
    tab specifically — a fresh tab's identical click worked immediately
    (confirmed via `element.scrollLeft`, not just a screenshot), so this
    was that tab's own stale state, not a code bug. (2) A delete-button
    click showed no visible error but `curl` against `/store/homepage-
    blocks` proved the row was still there; the identical click succeeded
    on retry. **When a browser-automation action looks like it worked but
    the result matters, verify against the real backend state, not the
    screenshot** — this is now the third phase in a row (C, D, E) where
    that check caught a genuine false-positive.
  - **Verified live against the real Supabase database, full round
    trip**: two published hero slides (single-slide static path, then
    carousel path with working prev/next dots verified via
    `scrollLeft`, not just visually); a promo block replacing the default
    entirely with only its populated fields shown; all test blocks deleted
    and both sections confirmed to cleanly revert to their original
    hardcoded defaults with zero visual difference from pre-Phase-E.
    `medusa lint`, `tsc --noEmit` (storefront + backend admin), `next
    lint`, a full `next build` (19 routes), and a full `medusa build` all
    clean.

- **Admin-first platform, Phase F: Product Merchandising (2026-08-11)** —
  the roadmap named three things ("labels, cross-sell curation, downloads/
  warranty text"); this phase ships two and explicitly defers the third.
  - **New `product-extras` module** — one row per product
    (`badge_label`, `badge_tone`, `warranty_text`, `downloads_url`), keyed
    by the real product id, upserted the same list-then-create-or-update
    way as `seo`. Real migration applied live; real runtime methods
    verified via `medusa exec` — no mismatch, following the now-standard
    practice.
  - **The custom badge is deliberately separate from the storefront's
    existing "Νέο"/"Προσφορά" badges** — those are computed from real
    price/date data (`onSale`, `isNewArrivalMember` in
    `lib/data/products.ts`), never admin-set. Mixing an admin-editable
    label into that fixed enum would have put a fabricatable value next
    to two data-driven ones, undermining the "these badges mean something
    real" property. Kept as a visually distinct third slot instead.
  - **Admin**: a second, independent widget (`Merchandising`) stacked in
    the same `product.details.side.after` zone as Phase A's SEO widget —
    confirms multiple widgets can coexist in one zone without conflict,
    useful precedent for any future product-detail-page addition.
  - **Two things explicitly deferred, not silently dropped**: (1)
    **cross-sell curation** — real manual curation needs a product-picker
    UI (search-and-add, many-to-many), a genuinely bigger separate build;
    automatic same-category cross-sell already exists via
    `getRelatedProducts` and stays as-is. (2) **badge on grid listings**
    (`ProductCard` everywhere it's used) — showing it there would mean
    batch-fetching `product-extras` across every product-listing call
    site in `lib/data/products.ts` (`getFeaturedProducts`,
    `getNewArrivals`, category listings, search, related, recently
    viewed), a broad change versus the one call this phase actually made
    on the PDP alone. **If a future phase wants grid-listing badges, it
    needs a batch endpoint (`?product_ids=a,b,c`) rather than N individual
    `/store/product-extras` calls per listing page** — worth designing
    for before touching `ProductCard`.
  - **Verified live against the real Supabase database, full round
    trip**: real badge (accent tone) + warranty + downloads on a real
    product, confirmed correct PDP rendering with an unrelated product's
    PDP and every grid listing completely unaffected; cleared all fields
    and confirmed the PDP cleanly reverts to showing neither the badge nor
    the Εγγύηση & Downloads section. `medusa lint`, `tsc --noEmit`, a full
    `next build` (19 routes), and a full `medusa build` all clean.

- **Admin-first platform, Phase G: Cart/Checkout Marketing Config
  (2026-08-11)** — a single admin-editable message in the cart drawer and
  cart page. Scope was self-defined (the roadmap's own bullet had no
  itemized list, unlike other phases).
  - **Deliberately did not touch `FreeShippingProgress`**
    (`lib/cart-config.ts` / `components/cart/FreeShippingProgress.tsx`,
    disabled since 2026-08-08). Its own code comment says the fix
    condition is "once a real free-shipping rule/promotion exists on the
    backend" — a real Medusa shipping/promotion engine change, not a
    content field. An admin-typed number wouldn't make the message true;
    both real shipping options are still flat-rate with no conditional
    discount. **If a future phase builds a real shipping-rule engine, that
    is the trigger to flip `FREE_SHIPPING_MESSAGE_ENABLED` back to `true`
    — not before, and not via a simple admin text/number field.**
  - **Deliberately excluded checkout's own order summary**
    (`CheckoutOrderSummary.tsx`) — kept minimal per
    `CHECKOUT_PREMIUM_SPEC.md`'s no-distraction principle for that screen;
    the message only shows pre-checkout.
  - Extended the existing `site-settings` singleton with one nullable
    `cart_message` column rather than a new module for one field — same
    pattern as reusing modules elsewhere in this initiative (Phase B
    reusing Phase A's `seo` module).
  - **A second, differently-shaped instance of the already-documented
    "Turbopack dev-server HMR goes stale" gotcha, found live**: opening
    the cart drawer triggered a client-side 404, and `curl` confirmed
    `/kalathi`/`/proionta/[handle]` were genuinely 404ing at the server.
    Root cause (found by running a full `next build`, which the dev
    server alone never would have surfaced): `.next/dev/types/
    routes.d.ts`/`validator.ts` — Next's own auto-generated route-typing
    files — were corrupted (unterminated string/template literals) from
    accumulated dev-server state across Phases D-G's many consecutive
    file edits without a restart. Different symptom from Phase C's stale
    fetch-cache finding (that was stale *data*; this was corrupted
    *generated TypeScript*), same root family (accumulated dev-server
    state on this Windows/Turbopack setup). **Fixed by deleting all of
    `apps/storefront/.next` and restarting** — a clean `next build`
    immediately after confirmed the code was never wrong. **General
    lesson, now confirmed twice with two different corruption shapes: when
    a dev-server-only error contradicts a clean `next build`, delete
    `.next` before spending more time debugging "broken" code that isn't
    broken.** Worth trying preemptively on any future session that's done
    many consecutive edit-and-preview cycles without a server restart, not
    just reactively after hitting a confusing error.
  - **Verified live against the real Supabase database, full round
    trip**: real cart message confirmed in both the drawer and `/kalathi`
    (after the `.next` fix), confirmed absent from checkout's order
    summary; cleared and confirmed it disappears from both surfaces.
    `medusa lint`, `tsc --noEmit`, a full `next build` (19 routes), and a
    full `medusa build` all clean.

- **Admin-first platform, Phase H: Search Management (2026-08-11)** —
  hidden/boosted/synonyms, deliberately respecting a real constraint the
  search ranking already commits to.
  - **`lib/search.ts`'s own existing design principle governed every
    decision here**: "every match is explainable as 'this tier matched'"
    — discrete tiers, never a blended numeric score. This is why
    "boosted" is a boolean (`is_search_boosted`) promoting a genuine match
    to a new top tier (`"boosted"`, rank -1, above `sku-exact`) rather
    than a numeric strength blended into a score — there's no continuous
    dimension to represent in this ranking model. **Any future search
    feature must respect this same constraint** — resist the urge to add
    a numeric weight/score field to search ranking without first checking
    whether it actually fits the existing tier system, or reconsider
    whether the tier system itself needs to change (a bigger call than
    one feature should make unilaterally).
  - **Hidden** (`hide_from_search`) and **boosted** (`is_search_boosted`)
    both live on the existing `product-extras` module (Phase F) as two
    more per-product booleans, surfaced in the same Merchandising widget
    — not a new module, since these are genuinely per-product settings
    like the badge/warranty fields already there.
  - **New `search-synonyms` module** — comma-separated term groups.
    Expansion happens before ranking: `rankSearchMatches` (`lib/
    search.ts`) now accepts `string | string[]` for its query parameter,
    and for each catalog item takes the best (lowest-rank) tier across
    every candidate query — still one explainable tier per match, chosen
    from several candidates instead of computed from one.
  - **Pinned (per-query, not per-product) was explicitly not built** —
    "always show product X first for query Y" is a query→product mapping,
    a different mechanic from a product-level flag that applies to every
    query it happens to match. Boosted is the closest thing shipped;
    true pinning is a real, flagged gap for a future phase.
  - **New batch endpoint** `/store/product-extras/search-overrides`
    (`{ hidden: string[], boosted: string[] }`) — the search catalog needs
    every product's flags in one request, unlike the PDP's existing
    single-product `/store/product-extras?product_id=` lookup. This is
    the concrete resolution of the batch-endpoint need flagged as
    deferred in Phase F's grid-listing-badge notes — solved here because
    search actually needed it, not preemptively.
  - **Verified live against the real Supabase database, full round
    trip**: a real synonym group ("τηγάνι, tigani, pan") plus a boosted
    real "Τηγάνι" product — searching the English synonym "pan" returned
    both matching products with the boosted one first; confirmed boosting
    doesn't leak into an unrelated query (zero results for "μαξιλάρι");
    confirmed hidden wins over boosted when both flags are set on the
    same product (fully absent from results, not just deprioritized) —
    this works simply because the hidden filter runs before the catalog
    is even built, so a hidden product's boost flag is never reached.
    Cleared all test data, confirmed clean revert. `medusa lint`, `tsc
    --noEmit`, a full `next build` (19 routes), and a full `medusa build`
    all clean — `.next` cleared proactively before this phase's dev
    server session, per Phase G's lesson (no repeat of that corruption).

- **Admin-first platform, Phase I: Media Library (2026-08-11)** —
  deliberately scoped down after checking a real constraint before
  building anything, not after.
  - **This backend has no object storage configured.** Medusa's default
    file provider is local-disk — real and working (it's what backs the
    product admin's existing "Media" upload button), but local-disk
    storage doesn't survive a real deployment without separately
    configuring S3 or an equivalent. Building a genuine upload feature on
    top of it now would produce files that only work in this dev
    environment and would need redoing the moment real hosting exists.
    **Asked the user how to scope this phase rather than guessing** —
    confirmed: a URL-based library (labeled external links), not real
    upload. **If a future session is asked to build real image upload for
    this project, check whether S3/object storage has been configured in
    `medusa-config.ts` first** — if not, that's the real blocker, not
    missing UI work.
  - **New `media-assets` module** — `label`/`url`/`alt_text`, genuine
    open-ended CRUD like Homepage CMS (Phase E) and Search Synonyms
    (Phase H). Every image field across this project (Hero/promo blocks,
    SEO social image) was already a plain URL text input filled in by
    hand — this gives the admin one place to label and reuse those URLs.
  - **Admin-only on purpose — no `/store/media-assets` route.** Nothing
    on the storefront reads this data yet; a future image-picker
    integration into existing fields (Hero, SEO, etc.) would be the thing
    that actually needs a public read endpoint, and that integration
    itself is a real, separate follow-up, not assumed or half-built here.
  - **Verified live against the real Supabase database, full round
    trip**: added a real labeled URL, confirmed it persisted via a direct
    `/admin/media-assets` fetch (not just the UI showing it); deleted it,
    confirmed the list is empty again. `medusa lint`, `tsc --noEmit`
    (backend admin), and a full `medusa build` all clean. No storefront
    changes this phase, so no storefront build was run.

- **Admin-first platform, Phase J: Campaigns (2026-08-11)** — a real
  countdown banner promoting a real Medusa Promotion; newsletter popup
  deliberately not built.
  - **Newsletter popup blocked on the same real gap Phase E already
    found**: the storefront's `Newsletter` component signup form has
    never been wired to a real email provider
    (`onSubmit={(e) => e.preventDefault()}`). Building a popup version of
    a non-functional form would be strictly worse than the current quiet
    non-functional inline one — more intrusive, still doesn't collect
    anything real. Stays blocked until a real provider integration
    happens, not attempted here.
  - **A real GraphQL naming collision, found live via `medusa
    db:generate`, not by guessing**: the obvious model name "campaign"
    is already a real entity in Medusa's own built-in Promotions module
    (`campaign.details`/`campaign.list` are genuine, pre-existing admin
    injection zones — this explains why those zone names looked oddly
    specific back in Phase A/B's `INJECTION_ZONES` review and were never
    used). Renamed the module to `promo-banner` before generating
    anything further. **This is also the architecturally correct
    design, not just a workaround**: the module is marketing copy
    promoting a real discount, never a second discount engine — real
    promotion/discount logic stays exactly where it already lived,
    Medusa's native Promotions feature. **Any future phase touching
    promotions/discounts should look at Medusa's real Campaign entity
    first** (via the Promotions section) rather than assuming a custom
    module is needed.
  - **New `promo-banner` module** — singleton, same shape as
    `site-settings` (headline/body/CTA/`ends_at`/`is_published`). The
    admin keeps `ends_at` in sync with their real promotion's dates
    themselves — same trust level as every other admin-entered fact in
    this project, not synced against Promotions data automatically (that
    would be real integration work, not attempted here).
  - **A real, browser-verified conversion bug caught before it shipped**:
    `<input type="datetime-local">` needs `YYYY-MM-DDTHH:mm` in local
    time; the backend stores a full ISO-8601-with-timezone string.
    Without converting between the two, the field would have silently
    shown blank for any real saved `ends_at` value — added
    `isoToLocalInputValue`/`localInputValueToIso` helpers in the admin
    route specifically for this.
  - **A real hydration bug found and fixed live during verification**:
    the first version of `PromoBannerBar` computed its initial countdown
    with `useState(() => remaining(banner.endsAt))` — calling
    `Date.now()` during render, which the server and the client's
    hydration pass can evaluate at slightly different instants, landing
    on different seconds. Confirmed live in the console (server rendered
    `36`, client computed `34`) — a genuine hydration-mismatch error, not
    a false alarm. **Fixed by starting the countdown state at `null` on
    every render (server and client's first paint identical) and only
    setting the real value inside a `useEffect`**, which runs strictly
    after hydration — the correct general pattern for any live clock in
    a server-rendered React tree. **Any future component that computes
    something from `Date.now()`, `Math.random()`, or other
    non-deterministic input during its initial render is at risk of the
    same bug** — compute it in an effect, not during render, whenever the
    component can be server-rendered. Re-verified with a fresh tab and a
    real actively-ticking banner afterward — zero console errors,
    confirming the fix actually worked rather than just re-testing an
    empty/unpublished state that would never have hit the bug.
  - **Verified live against the real Supabase database, full round
    trip**: a real banner with a future `ends_at` showed a live, ticking
    countdown; forced `ends_at` into the past via a direct API call and
    confirmed `/store/promo-banner` immediately started returning `null`
    and the storefront banner disappeared entirely; cleared all fields,
    confirmed clean revert. `medusa lint`, `tsc --noEmit` (storefront +
    backend admin), a full `next build` (19 routes), and a full `medusa
    build` all clean.

- **Admin-first platform, Phase K: Analytics/Consent (2026-08-11)** — the
  final phase of the roadmap. A real, functioning cookie-consent banner
  gating four optional admin-entered tracking-service IDs, not a
  cosmetic one.
  - **New `analytics-settings` module** — singleton, same shape as
    `site-settings`/`promo-banner`: four nullable text fields (GA4
    Measurement ID, GTM Container ID, Meta Pixel ID, Microsoft Clarity
    Project ID), none fabricated or pre-filled. Model name
    `analytics_setting` (singular) for the same regular-pluralization
    reason as `site_setting` — verified live via a throwaway `medusa
    exec` script that the real runtime methods
    (`listAnalyticsSettings`/`createAnalyticsSettings`/
    `updateAnalyticsSettings`) match the generated types, standing
    practice since the `seo` module's `Seo`/`Seoes` mismatch. No
    mismatch found here.
  - **Consent architecture — three pieces sharing one localStorage-backed
    external store, not talking to each other directly**:
    `lib/consent-storage.ts` (same `useSyncExternalStore` shape as
    `wishlist-storage.ts`, for the same SSR/hydration reasons — the
    server has no localStorage, so "no choice yet" is the correct
    honest server-rendered state); `ConsentBanner`, which renders only
    if at least one service is configured *and* no choice is stored yet;
    `AnalyticsScripts`, which renders nothing until the stored choice is
    exactly `"accepted"`, then injects one independent `next/script`
    block per configured service. **GTM's own `<noscript>` iframe
    fallback is deliberately omitted** — a visitor with JavaScript
    disabled can never interact with `ConsentBanner` to grant consent in
    the first place, so an unconditional `noscript` tag would load
    tracking with no consent signal at all. If a future phase adds a
    fifth tracking service, follow this exact three-piece pattern rather
    than inventing a new consent mechanism.
  - **Verified live against the real Supabase database, full round
    trip**: configured GA4 + GTM via the Admin API directly (faster/more
    reliable than the dashboard through browser automation, standing
    practice in this project); confirmed the banner appears with
    literally nothing loaded (`gtag`/`gtm`/`fbq`/`clarity` script tags
    all absent from the DOM, `window.dataLayer` undefined); accepted and
    confirmed GA4+GTM scripts injected, Meta Pixel/Clarity correctly
    absent (not configured), `dataLayer` populated, banner gone;
    reloaded and confirmed acceptance persists with scripts loading
    immediately and no banner; cleared the stored choice and confirmed
    the banner reappears; rejected and confirmed no scripts, banner
    gone, `"rejected"` stored; reloaded and confirmed the rejection
    persists and nothing loads; cleared all four admin fields and
    confirmed the banner does not appear at all even with no stored
    choice, since there's nothing to consent to. `medusa lint`,
    `eslint` (storefront), a full `next build` (19 routes, unchanged),
    and a full `medusa build` all clean.
  - **The `computer` tool's click landed on stale coordinates for the
    Reject button specifically** (same documented browser-automation
    unreliability as prior sessions — see "Warnings" in `NEXT_STEPS.md`)
    — worked around by dispatching the click directly via
    `javascript_tool` (`[...document.querySelectorAll('button')].find(b
    => b.textContent.trim() === 'Απόρριψη').click()`) and confirming the
    resulting state via `localStorage`/DOM inspection rather than
    trusting the click alone. The Accept button's click *did* register
    on a `ref`-targeted retry — inconsistent, not a hard rule about
    which button fails, just more evidence that any click/type in this
    environment needs independent verification, not just the click
    tool's own success report.
  - **Re-hit the disk fetch-cache staleness bug already documented from
    an earlier session** (see "Warnings" in `NEXT_STEPS.md`): after
    clearing all four fields via the Admin API, the storefront kept
    showing the banner well past `next: { revalidate: 30 }`. Confirmed
    via a direct `curl` to `/admin/analytics-settings` that the database
    was already correct before touching any application code, then
    cleared `apps/storefront/.next/cache` and restarted the dev server
    to resolve it — exactly the documented remedy, not a new bug.
  - **This closes the Admin-first platform roadmap.** Phases A through K
    are all built, verified live, and committed.

- **Admin-first platform post-implementation audit (2026-08-12)**: the
  first holistic review of everything Phases A-K shipped (as opposed to
  each phase's own self-contained verification). Full findings and fixes
  are in `CHANGELOG.md`'s matching entry; the two load-bearing takeaways
  to remember if this surface is touched again:
  - **`ends_at`/expiry-style checks on a free-text date field must fail
    closed, not open.** `new Date(x).getTime() <= Date.now()` silently
    evaluates `false` for an unparseable `x` (`NaN <= anything` is
    `false` in JS) — found live in both `promo-banner`'s store route and
    its own admin page. Any future admin-entered "expires at"/"valid
    until" field needs an explicit `Number.isNaN` guard that resolves to
    "expired/hidden," not "still live."
  - **Every admin create/update route needs the same validation
    discipline as `seo`/`content-pages`/`homepage-blocks`'s create
    route** — a 400 with a message for a missing required field, not a
    bare pass-through to the workflow that lets the DB's NOT NULL/check
    constraint throw an unhandled 500. `media-assets` and
    `search-synonyms` had none at all before this audit; `homepage-
    blocks`' own update route was missing the same `kind` check its
    create route already had. Copy this pattern for any new module.
  - Also fixed: no admin route anywhere had error handling on its
    initial-load `fetch` (a failed GET looked identical to "nothing
    saved yet") — now every singleton/list page's load effect has a
    `.catch()` + error toast; `product-extras`' single-product store
    route was trimmed to stop exposing `hide_from_search`/
    `is_search_boosted` (internal search-tuning flags, not needed by the
    PDP consumer); accessibility (`htmlFor`/`id` linking on every text
    field, missing `<Label>`s in Media/Search) and narrow-sidebar
    `grid-cols-2` layouts (the product detail page's side rail) were
    also fixed for consistency.
  - **Not fixed, flagged as a real but low-priority gap**: `site-
    settings`/`promo-banner`/`analytics-settings` enforce "exactly one
    row" only at the workflow level (list-then-create-or-update), no DB
    unique constraint — a real race under concurrent writes, low
    likelihood for a single-admin internal tool, would need a new
    migration per module to close properly. Revisit if this ever becomes
    a multi-admin-editor tool.
  - A seventh temporary admin user, `qa-agent6@stia.gr`, was created for
    this audit's live Admin API verification — same established pattern
    as its six predecessors, harmless, left in place.

## Customer authentication architecture (2026-08-12)

Built because the header/mobile-menu account icon pointed at `/logariasmos`
with nothing behind it — confirmed by inspection that no auth system
existed anywhere in this codebase before this. Full flow: register, login,
logout, forgot/reset password (real email via the existing SendGrid
integration, degrades to a logged no-op the same way order confirmations
do when unconfigured — confirmed live), a protected dashboard (profile,
address book, order history, change password), and a live link to the
already-existing `/lista-epithymion` for wishlist rather than a duplicate.

- **Session**: Medusa's JWT in an httpOnly, `sameSite=lax` cookie
  (`_medusa_jwt`) — exact same shape and reasoning as the cart's `cart_id`
  cookie. Set/cleared only from Server Actions (`lib/actions/customer.ts`),
  read via `getCustomer()` (`lib/data/customer.ts`, never throws — an
  expired/invalid token reads as "not logged in," same discipline as
  `getCart()`).
- **Register flow is three real Medusa calls**, not one — verified against
  the installed `@medusajs/medusa` package's actual route source rather
  than assumed: `POST /auth/customer/emailpass/register` (actorless
  token) → `POST /store/customers` (creates the customer, links it to the
  auth identity) → `POST /auth/token/refresh` (now returns a token with
  the customer attached). Skipping the refresh step leaves a customer that
  exists but can never be "logged in" as via the register response alone.
- **Password change while already logged in needed a custom route** —
  Medusa's own `POST /auth/customer/emailpass/update` only accepts a
  reset-purpose token (its `validateToken` middleware explicitly rejects a
  normal session/bearer token), there is no core "change my password"
  endpoint. Added `POST /store/customers/me/password`
  (`src/api/store/customers/me/password/route.ts`) — already covered by
  Medusa's own `/store/customers/me*` wildcard customer-auth middleware,
  no new middleware registration needed. Verifies the current password via
  `authModuleService.authenticate("emailpass", ...)` (read-only, stays in
  the route), then the actual mutation runs in a workflow step
  (`change-customer-password.ts`) — required by this repo's
  `@medusajs/no-service-mutations-in-api-route` lint rule, which core
  Medusa's own auth routes don't follow (they predate/bypass it) but this
  project's lint config enforces for custom routes.
- **Password reset email**: `auth.password_reset` is Medusa's own emitted
  event (`generateResetPasswordTokenWorkflow`, 15-minute single-use token)
  — a new subscriber (`src/subscribers/auth-password-reset.ts`) builds the
  storefront reset link and sends it via the same notification module as
  order confirmations, same "never let an optional email break the
  primary flow" try/catch discipline as `order-placed.ts`.
- **Addresses reuse `Address`** (the checkout form's Greek Οδός/Αριθμός-
  split type) for the saved address book, `AddressSummary`/`Order` for
  order history — no new shapes invented where an existing one already
  fit. Order history's "view details" link reuses the guest checkout
  confirmation page (`/checkout/epibebaiosi?order=:id`) rather than a new
  detail page — already confirmed elsewhere in this codebase to work with
  just the order id, no session required.
- **Not built this round** (out of scope for this pass, flagged, not
  silently skipped): merging a guest cart into the customer session on
  login, syncing wishlist server-side for logged-in customers, checkout
  auto-fill from a saved address. All three are real, natural follow-ups
  once this base exists, not forgotten.
- Test accounts created live during verification (`test-account-*@stia.gr`
  in the browser, two `curltest*@stia.gr` via direct API calls) — same
  "harmless, cleanup whenever convenient" status as this project's other
  documented test artifacts.

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
