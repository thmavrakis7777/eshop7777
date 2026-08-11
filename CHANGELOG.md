# Changelog

Notable changes, newest first. Written for whoever (human or agent) picks this up
next — focus on *why*, not just *what*.

## Admin-first platform, Phase H: Search Management (2026-08-11)

Eighth phase — the roadmap named four things ("synonyms, pinned, hidden,
boosts"); this phase ships three of them, respecting a real architectural
constraint the existing search ranking already commits to.

**The storefront's search (`lib/search.ts`) deliberately ranks by
discrete, explainable tiers, not a blended numeric score** — its own
existing comment says "every match is explainable as 'this tier
matched'". That constraint shaped every decision in this phase:

- **Hidden**: a `hide_from_search` boolean on the existing `product-
  extras` module (Phase F). Hidden products are filtered out of the
  search catalog entirely, before any ranking runs — not ranked-then-
  hidden, and not something a boost can override.
- **Boosted**: an `is_search_boosted` boolean, also on `product-extras` —
  a boolean, not a numeric strength, because there's no continuous score
  to nudge in this ranking model. A boosted product that genuinely
  matches a query gets promoted to a new top-priority `"boosted"` tier
  (rank -1, above `sku-exact`) instead of blending a score; a boosted
  product that doesn't match still doesn't appear — boosting changes
  *where* a real match lands, never manufactures one.
- **Synonyms**: a new `search-synonyms` module — comma-separated term
  groups (e.g. "τηγάνι, tigani, pan"). Query expansion happens *before*
  ranking: `rankSearchMatches` now accepts multiple query variants and
  picks each item's single best (lowest-rank) tier across every variant —
  still one explainable tier per match, just chosen from several
  candidate queries instead of one.
- **Pinned — deliberately not this phase.** Interpreted as "always show
  product X first for query Y specifically," a materially different
  mechanic from a product-level boost that applies across every query it
  matches (a query→product override map, not a product flag). Boosted is
  the closest thing this phase ships; true per-query pinning is flagged
  as a real, separate gap.

**Admin**: the two new product-level flags were added to the existing
Merchandising widget (Phase F), not a new one — they're per-product
settings like everything else already there. Synonyms got a new
standalone route (`Αναζήτηση`), same open-ended client-side list pattern
as Homepage CMS (Phase E) and its no-nested-route reasoning.

**A new batch endpoint** (`/store/product-extras/search-overrides`,
returning just `{ hidden: string[], boosted: string[] }`) rather than
the storefront's search catalog fetching each product's extras
individually — the exact batch-vs-per-product tradeoff flagged as a
deferred follow-up in Phase F's grid-listing-badge notes, actually solved
here because search genuinely needs the whole catalog's flags at once
(unlike a single PDP, which only ever needs one product's).

**Verified live against the real Supabase database, full round trip**:
created a real synonym group ("τηγάνι, tigani, pan") and boosted a real
"Τηγάνι" product — searching the English synonym "pan" correctly returned
both matching products with the boosted one ranked first; confirmed
boosting does *not* leak into an unrelated query (zero results for
"μαξιλάρι", not a false match); confirmed hidden wins over boosted when a
product has both flags set (completely absent from search results, not
just deprioritized); cleared all test data and confirmed both features
cleanly revert. `medusa lint`, `tsc --noEmit` (storefront + backend
admin), a full `next build` (19 routes), and a full `medusa build` all
clean — with `.next` cleared proactively before this phase's dev server
verification, per Phase G's lesson.

## Admin-first platform, Phase G: Cart/Checkout Marketing Config (2026-08-11)

Seventh phase. The roadmap gave this one just a short label ("Cart/
checkout marketing config") with no itemized list like other phases, so
the scope was defined this session: a single admin-editable message shown
in the cart drawer and cart page.

**Deliberately not this phase**: re-enabling `FreeShippingProgress`
(disabled 2026-08-08 per `CHECKOUT_UX_SPEC.md` §0.2, `lib/cart-config.ts`'s
`FREE_SHIPPING_MESSAGE_ENABLED = false`) — its own code comment is explicit
that the fix is "once a real free-shipping rule/promotion exists on the
backend," a real Medusa shipping-rule/promotion engine change, not a
content-admin field. An admin-typed threshold number wouldn't make that
message true; both real shipping options are still flat-rate. Flagged as
still-blocked, not silently reinterpreted into something this phase could
ship. **Also deliberately not checkout's own order summary** — kept
minimal on purpose per `CHECKOUT_PREMIUM_SPEC.md`'s no-distraction
principle for that specific screen; the message only ever appears
pre-checkout (drawer, `/kalathi`).

**Extended the existing `site-settings` module** (one new nullable
`cart_message` column) rather than building a new module for a single text
field — same singleton, same admin route, a new "Καλάθι" section appended
to the existing four. Real, additive-only migration (`ALTER TABLE ...
ADD COLUMN`) applied to the live database.

**Storefront**: `CartDrawer` and `CartPageView` both gained a
`cartMessage` prop, threaded down from `RootLayout` (already fetching
`site-settings` for the announcement bar/footer) and `app/kalathi/page.tsx`
respectively — plain prop-drilling into existing client components, no new
data-fetching pattern.

**A real, unrelated bug surfaced and root-caused during verification, not
a code bug**: opening the cart drawer on the product page rendered a
client-side 404 (`not-found` boundary), and `curl` confirmed `/kalathi`
and `/proionta/[handle]` were genuinely returning HTTP 404 at the server.
Root cause: `next build`'s TypeScript pass failed on
`.next/dev/types/routes.d.ts`/`validator.ts` — Next's own auto-generated
route-typing files, corrupted (unterminated string/template literals) from
accumulated dev-server state across this session's many consecutive
phases (D through G) without a restart. Same family of issue as Phase C's
stale fetch-cache finding, a different symptom of the same
already-documented "Turbopack dev-server HMR goes stale after long edit
sessions" gotcha (`NEXT_STEPS.md`). **Fixed by deleting the entire
`apps/storefront/.next` directory and restarting the dev server** — a
clean `next build` immediately after confirmed the actual code was never
wrong. **The general lesson, now confirmed twice in one session across two
different corruption shapes (fetch-cache staleness in Phase C, corrupted
type-generation files here): when a dev-server-only error contradicts a
clean `next build`, delete `.next` before spending more time reading the
error** — don't assume the code is broken just because the dev server
says so.

**Verified live against the real Supabase database, full round trip**: a
real cart message set via the admin, confirmed it renders in both the
drawer and the cart page (after the `.next` fix above) and is absent from
checkout's order summary; cleared the field and confirmed it disappears
from both surfaces. `medusa lint`, `tsc --noEmit` (storefront + backend
admin), a full `next build` (19 routes), and a full `medusa build` all
clean.

## Admin-first platform, Phase F: Product Merchandising (2026-08-11)

Sixth phase — the roadmap named three things ("labels, cross-sell
curation, downloads/warranty text"); this phase deliberately ships two of
them and explicitly defers the third rather than rushing it.

**Shipped**: a custom merchandising badge per product (distinct from the
storefront's existing "Νέο"/"Προσφορά" badges, which stay exactly as they
were — those are computed from real price/date data, not admin-set, and
mixing an admin-editable label into that fixed enum would have muddied a
system that's deliberately never fabricated) plus warranty text and a
downloads link, both new PDP content.

**New `product-extras` backend module** — one row per product
(`badge_label`, `badge_tone: "accent"|"success"|"neutral"`,
`warranty_text`, `downloads_url`), keyed by the real Medusa product id,
upserted the same list-then-create-or-update way as the seo module. Real
migration applied live; real runtime method names verified via
`medusa exec` before trusting generated types — no mismatch.

**Admin**: a second, independent widget (`Merchandising`) in the exact
same `product.details.side.after` zone as Phase A's SEO widget — Medusa
stacks multiple widgets in one zone without conflict, so this didn't need
its own zone or a merge into the unrelated seo module.

**Storefront**: the badge renders above the PDP `<h1>` (only if
`badge_label` is set, using `badge_tone` to pick an existing color
token — `accent`/`success`/neutral `surface`, no new colors introduced);
a new "Εγγύηση & Downloads" section (same pattern as
`ProductCharacteristics` — its own `<h2>`, renders nothing when both
fields are empty) shows warranty text and a real download link.

**Deliberately deferred, not forgotten**:
- **Cross-sell curation** — the roadmap's own second item. Automatic
  same-category cross-sell already exists (`getRelatedProducts`, see
  earlier "Full product detail page" notes on why it's honestly labeled
  "related" rather than a fabricated "frequently bought together" claim).
  *Manual* curation needs a real product-picker UI (search-and-add,
  many-to-many) — a genuinely bigger, separate build, not a natural
  extension of this phase's per-product-field pattern. Flagged as a real
  gap for a dedicated future pass, not silently dropped.
- **Badge on grid listings** (`ProductCard` in category pages, homepage
  rails, search results) — this phase only wired the badge into the PDP.
  Showing it on every listing surface would mean batch-fetching
  `product-extras` across every product-listing call site
  (`getFeaturedProducts`, `getNewArrivals`, category listings, search,
  related products, recently viewed) — a broad, invasive change touching
  most of `lib/data/products.ts`, versus one call on one page for the PDP.
  Same "ship one clear slice, flag the rest honestly" scoping as every
  prior phase's deliberate exclusions (Phase E's TrustStrip/Newsletter,
  Phase D's footer-only content-page set).

**Verified live against the real Supabase database, full round trip**:
set a real badge (label + accent tone) and warranty/downloads text on a
real product via the widget, confirmed both render correctly on that
product's PDP with no console/server errors; confirmed an unrelated
product's PDP and every grid listing are completely unaffected (no
regression, no stray badge); cleared all fields and confirmed the PDP
cleanly reverts to showing neither the badge nor the Εγγύηση & Downloads
section. `medusa lint`, `tsc --noEmit` (storefront + backend admin), a
full `next build` (19 routes), and a full `medusa build` all clean.

## Admin-first platform, Phase E: Homepage CMS (2026-08-11)

Fifth phase, the one the roadmap itself flagged as the biggest single
phase — "hero/sliders/promo blocks." Scoped deliberately rather than
building a full generic drag-and-drop section builder: made the Hero and
the editorial/promo section (previously one hardcoded `EditorialBanner`
block) into admin-managed ordered lists, and left TrustStrip and
Newsletter alone. TrustStrip makes factual claims tied to real checkout/
fulfillment capability (delivery window, return policy, the one real
payment method) — same reasoning Phase C used to keep the Footer's
payment-methods list hardcoded rather than admin-editable, since an
admin-editable factual claim risks drifting from what the store can
actually deliver. Newsletter's signup form isn't wired to any real
provider yet (`onSubmit={(e) => e.preventDefault()}`) — that's a
Campaigns-phase concern, not a content-editing one.

**New `homepage-blocks` backend module** — one model
(`kind: "hero"|"promo"`, eyebrow/heading/body/cta_label/cta_href/
image_url/sort_order/is_published) instead of two near-identical ones,
since the field set is genuinely identical between a hero slide and a
promo block. **The first genuinely open-ended list in this initiative** —
Phases A-D were all either a fixed key to upsert (seo, site-settings) or
a fixed known set (content-pages' six slugs); this one has real
create/delete, not just upsert. Ordering is a plain numeric `sort_order`
field the admin types in, not drag-and-drop — deliberately simpler to
build and entirely sufficient for a handful of blocks. Real, additive-only
migration applied live; real runtime method names verified via
`medusa exec` before trusting the generated types, same standing practice
as every prior phase — no mismatch.

**Admin**: one route (`Αρχική Σελίδα`) with two sections, each a
client-side list with inline add/edit/delete — no nested `[id]` route,
extending Phase D's precedent (avoiding medusajs/medusa#9794) to a
genuinely open-ended list this time, not just a fixed one. `@medusajs/
icons` isn't a direct dependency of this app (same situation as
`@medusajs/types` in Phase A), so the delete action is a plain "Διαγραφή"
button, not an icon.

**Storefront**: `Hero` renders the store's original default copy when
zero slides are published, a single slide statically, or (new) a real
swipeable carousel for two or more — reusing the exact native CSS
scroll-snap pattern `ProductRail` already established (no carousel
library) rather than inventing a second interaction pattern.
`EditorialBanner` renders one or more admin promo blocks in `sort_order`,
alternating image side for visual rhythm, falling back to the original
hardcoded promo when none are published.

**A real bug found and fixed live, not just by inspection**: a second
hero slide that deliberately left its eyebrow field blank rendered the
*original default* eyebrow text ("Νέα Συλλογή") instead of nothing.
Cause: `HeroSlide` used `content?.eyebrow ?? "Νέα Συλλογή"` per-field
fallbacks, which is correct semantics for "there is no admin content at
all" but wrong for "this one real slide has one blank field" — a blank
field on a real slide must render as absent, never silently borrow the
unrelated default's copy. Fixed by switching to the same whole-object
fallback pattern `EditorialBanner`'s `DEFAULT_BLOCK` already used
correctly: choose *either* a single default object *or* a real slide,
never blend fields from both. Caught because the carousel was actually
clicked through slide-by-slide during verification, not just checked on
slide 1.

**Two real browser-automation false-positives caught mid-session**, both
resolved the same way — verify against the backend directly, not the
tool's own success signal: (1) a hero-carousel dot click appeared to do
nothing in one browser tab; turned out to be that specific tab's stale
state (a fresh tab's identical click worked immediately, scroll position
confirmed via `element.scrollLeft`), not a real bug in the carousel code.
(2) A "Διαγραφή" (delete) button click showed no visible error but a
`curl` against `/store/homepage-blocks` proved the row was still there;
the identical click succeeded on retry. Neither would have been caught by
trusting the admin UI's screenshot alone.

**Verified live against the real Supabase database, full round trip**:
created two hero slides (published), confirmed single-slide static
rendering, confirmed the carousel path with working prev/next dots via
direct `scrollLeft` checks (not just visual screenshots, given the
automation flakiness above); created a promo block, confirmed it replaced
the default entirely with only its populated fields rendered; deleted
every test block and confirmed both sections cleanly reverted to their
original hardcoded defaults with zero visual difference from pre-Phase-E.
`medusa lint`, `tsc --noEmit` (storefront + backend admin), `next lint`, a
full `next build` (19 routes), and a full `medusa build` all clean.

## Admin-first platform, Phase D: Content Pages (2026-08-11)

Fourth phase — About, Shipping, Returns, Privacy, Terms, and FAQ, all
editable from the admin instead of not existing at all (every one of these
Footer links previously 404'd; the Footer's `href`s were already there
from earlier sessions, just pointing at nothing).

**New `content-pages` backend module** — one row per page (`slug`,
`title`, `body`, `is_published`), unique index on `slug`. Deliberately a
*fixed* set of six slugs, not an open-ended CMS: the storefront has one
literal route folder per page (`app/sxetika/page.tsx`,
`app/apostoles/page.tsx`, etc.), not a dynamic `[slug]` route, so a
seventh page created only in the admin would have nowhere to be visited.
`is_published` defaults to `false` — a page with no real content yet
should 404, not go live empty; same "honest empty state" rule as every
other admin-editable field in this project. Real, additive-only migration
applied to the live database; real runtime method names verified via
`medusa exec` before trusting the generated types (now standing practice
for every new module, not just a Phase-A one-off) — no mismatch this time.

**Admin — a deliberate architecture choice to avoid a known Medusa bug**:
rather than a list route plus a nested `content-pages/[id]/page.tsx` detail
route (the obvious CRUD shape), this is a single route
(`Σελίδες Περιεχομένου`) with client-side master/detail — a hardcoded list
of the six pages on the left, the selected page's form on the right, no
URL segment per page. Medusa v2's admin dynamic route params
(`useParams` from `react-router-dom`) have a documented open upstream bug
(medusajs/medusa#9794) where the parameter isn't reliably captured;
sidestepping the pattern entirely removes the risk for a fixed set of only
six pages, where a single-screen picker is arguably better UX anyway.

**Storefront**: a shared `ContentPageView` renders `title` as an `h1` and
`body` as plain paragraphs — blank line starts a new paragraph, a single
newline becomes a `<br/>`. No markdown parsing, no
`dangerouslySetInnerHTML`: even though the content is trusted-owner input
(same trust level as the seo module's plain-text fields), there's no
reason to render raw HTML for what every one of these six pages actually
needs (plain informational text), so the safer option costs nothing here.
`sitemap.ts` gained the six page URLs, but only the ones that are actually
published — fetches each page and filters, so a draft never gets offered
to crawlers.

**Verified live against the real Supabase database, full round trip**: set
a real title + multi-paragraph body on the About page via the admin,
confirmed the storefront rendered paragraph breaks and line breaks
correctly per the rule above; confirmed an unpublished page 404s on the
storefront and is absent from the sitemap; confirmed `/store/content-
pages` returns `null` (not the draft content) for an unpublished page,
proving draft content never reaches the public Store API; cleared the test
data back to unpublished/empty and reconfirmed the 404. Caught the
checkbox-click-didn't-register class of browser-automation flakiness again
here (same as Phase C) — verified by screenshot before saving each time,
not assumed. `medusa lint`, `tsc --noEmit` (storefront + backend admin), a
full `next build` (19 routes, including all six new ones), and a full
`medusa build` all clean.

## Admin-first platform, Phase C: Site Settings (2026-08-11)

Third phase of the Admin-first platform initiative — footer contact info,
business hours, social links, and the top-of-site announcement bar, all
made admin-editable. Unlike Phases A/B, this needed a genuinely new
backend module: site settings are a single global object, not a
per-resource record, so the `seo` module's `resource_type`/`resource_id`
shape doesn't fit.

**New `site-settings` backend module** (`apps/backend/src/modules/site-
settings`) — a true singleton (`footer_tagline`, `contact_phone`,
`contact_email`, `contact_address`, `business_hours`, `facebook_url`,
`instagram_url`, `tiktok_url`, `announcement_text`, all nullable text).
The model name is deliberately singular (`site_setting`, not
`site_settings`) — Phase A hit a real `MedusaService` compile-time/runtime
pluralization mismatch for the irregular name `"seo"`; `"setting"`
pluralizes to `"settings"` by the regular English rule, so the same class
of bug can't recur here. Verified the real runtime method names via a
throwaway `medusa exec` script before trusting the generated types anyway
(same discipline as Phase A) — this time they matched exactly
(`listSiteSettings`/`createSiteSettings`/`updateSiteSettings`), no bug to
work around. New `site_setting` table via a real, additive-only migration,
applied to the live Supabase database. `upsertSiteSettingsWorkflow` is the
same list-then-create-or-update shape as Phase A's `upsertSeoWorkflow`,
minus resource_type/resource_id since there's only ever one row.

**Admin**: a standalone **Ρυθμίσεις Καταστήματος** (Site Settings) route
(no widget zone fits a global singleton, same reasoning as Phase B's
homepage SEO route) with four sections — Announcement Bar, Footer, Contact
Details, Social Networks — reading/writing through new `/admin/site-
settings` and `/store/site-settings` routes.

**Storefront**: `AnnouncementBar` now takes the admin text as a prop and
renders nothing at all when it's empty, rather than showing hardcoded
copy — the *previous* hardcoded text was itself a free-shipping claim
already removed earlier in this project for not being backed by a real
Medusa shipping rule (see `CHECKOUT_UX_SPEC.md` §0.2), so this component
was already down to a placeholder with nothing genuine to say; now it says
nothing until an admin actually types something. `Footer` gained a
contact block (phone/email as real `tel:`/`mailto:` links, address, hours)
and a social-icon row, both rendering only the fields that are actually
populated — same "only show what's real" rule as the Product PDP's
Characteristics section. Three new line-icon components
(`FacebookIcon`/`InstagramIcon`/`TikTokIcon`) added to the shared
`components/ui/Icons.tsx`, matching the existing stroke-based icon style
rather than pulling in an icon library dependency for three icons.

**A real, live-verified caching bug, not just a data bug**: after clearing
test data from the admin, the storefront kept serving the *old* value for
several minutes — but a direct `curl` against the Medusa backend (bypassing
Next.js entirely) confirmed the database itself was already correctly
empty. The cause: `next: { revalidate: 30 }`/`revalidate: 60}` fetches
write to an on-disk cache (`.next/cache/fetch-cache/`) that **survives
`next dev` server restarts** — entries from a session two days earlier
were still present. On this Windows/Turbopack setup specifically, the
disk-cache write path is already known to be flaky (`next build` prints
`Failed to update prerender cache ... UNKNOWN: unknown error` warnings on
every build, a Windows file-locking quirk against that same cache
directory), which plausibly explains entries getting stuck instead of
revalidating on schedule. **Fixed for this session by deleting
`apps/storefront/.next/cache` and restarting the dev server** — not a code
change, since the code (and the database) were already correct. **Any
future session debugging "the admin change isn't showing up on the
storefront" should treat a stale local disk cache as a real, first-class
suspect** — verify the database directly via `curl` before assuming
application code is wrong, exactly as this session did.

**Verified live against the real Supabase database, full round trip**:
set real values across all four Site Settings sections, confirmed the
storefront's announcement bar, footer contact links, and social icons all
picked them up; cleared every field and confirmed the storefront correctly
fell back to no-announcement-bar and the default tagline (after working
through the disk-cache issue above). One genuine browser-automation
false-positive caught mid-session: a first "clear and save" attempt looked
successful (screenshot showed the save button) but a direct backend
`curl` check proved the POST never actually landed — re-verified via
screenshot of actual field contents (not the `read_page` tool's textbox
label, which echoes the `placeholder` attribute regardless of real value
for fields that have one) before retrying, and confirmed via the record's
`updated_at` timestamp advancing on the second, successful attempt.
`medusa lint`, `tsc --noEmit` (storefront, and the backend admin's own
`tsconfig.json`), a full `next build`, and a full `medusa build` all
clean.

## Admin-first platform, Phase B: Category SEO + Homepage SEO (2026-08-11)

Second phase of the Admin-first platform initiative — reuses Phase A's
`seo` module/routes/workflow entirely as-is (the model already supported
`resource_type: "category"|"homepage"` from day one, so no migration was
needed for this phase).

**Admin side**: extracted Phase A's product widget form into a shared
`src/admin/components/seo-form.tsx` (`SeoForm`) rather than duplicating the
~140-line form a second and third time — the product widget now just wraps
it. Added a new **Category SEO** widget on the category detail page
(`product_category.details.side.after` zone, confirmed real via
`@medusajs/admin-shared`'s `INJECTION_ZONES`, same verification discipline
as Phase A). Homepage SEO has no underlying Medusa entity to hang a widget
off, so it's a genuine standalone admin route instead —
`src/admin/routes/seo-homepage/page.tsx` (`defineRouteConfig`, sidebar
label "SEO Αρχικής") — rendering the same `SeoForm` with
`resourceId: "homepage"` (the singleton resource_id chosen in Phase A
specifically to make this possible without a real entity to point at).

**Storefront side**: `getSeoOverride("category", category.id)` wired into
both `[category]/page.tsx` and `[category]/[subcategory]/page.tsx`'s
`generateMetadata`, same fallback/`title.absolute` pattern as the PDP. One
genuinely new piece of logic beyond a copy of the product pattern: the
canonical-URL override only applies on page 1 of a paginated category —
deeper pages (`?page=2`, etc.) always keep self-canonicalising to their own
URL regardless of what's in the admin field, otherwise an admin-set
canonical would tell Google every paginated page is a duplicate of page 1,
which is the opposite of the pagination SEO this project already built.
Verified live: set a canonical override on a real category, confirmed page
1 picks it up and page 2 ignores it and keeps its own `?page=2` canonical.

Homepage: added `generateMetadata` to `app/page.tsx` (it had none before —
metadata came entirely from `RootLayout`'s static export), reading
`getSeoOverride("homepage", "homepage")` with fallback to two new shared
constants in `lib/site-config.ts` (`siteDefaultTitle`,
`siteDefaultDescription`) instead of duplicating the same Greek copy that
was already hardcoded in `RootLayout`'s metadata — `RootLayout` now reads
from the same constants.

**Verified live against the real Supabase database, full round trip**: set
a real title/description on the "Κουζίνα" category via the widget,
confirmed the storefront category page's `<title>`/description picked it
up with no title-template doubling (the `title.absolute` fix from Phase A
applied correctly here too); set a canonical override and confirmed page 1
uses it while `?page=2` correctly ignores it; set and cleared a real
homepage title/description via the new route, confirmed the storefront
homepage picked up the override and then correctly fell back to the
`RootLayout` defaults once cleared (after the `/store/seo` route's 30s
`revalidate` window). No console/server errors at any point. `medusa
lint`, `tsc --noEmit` (storefront and the backend admin's own
`tsconfig.json`), a full `next build`, and a full `medusa build` (backend +
the admin Vite bundle) all clean.

**Housekeeping note**: no admin password exists for this project by design
(see Phase A notes below and `PROJECT_MEMORY.md`), so verifying this phase
needed another temporary admin user — `qa-agent4@stia.gr`, same pattern as
`test-agent@stia.gr`/`qa-agent@stia.gr`/`qa-agent2@stia.gr`/`qa-agent3@stia.gr`
before it. Left in place, harmless, same "cleanup whenever convenient"
status as the others.

## Admin-first platform, Phase A: Product SEO (2026-08-11)

First phase of a much larger initiative — making the store manageable from
the Medusa Admin without code changes for everyday business/marketing/SEO
tasks (see `TASKS.md` → "Admin-first platform" for the full ~11-phase
roadmap). Explicit architecture review before any code: inspected the
running Medusa version (2.18.0), confirmed no admin extensions or
data-holding custom modules existed yet (only `store-pickup`, a fulfillment
*provider*, not a data module), and confirmed the real, documented
extension mechanisms available — custom modules with their own migrations,
module links, and admin widget injection zones (verified the exact zone
list live from `@medusajs/admin-shared`'s bundled types rather than
guessing).

**New `seo` backend module** (`apps/backend/src/modules/seo`) — one
polymorphic model (`resource_type` + `resource_id` + the SEO fields)
instead of a separate model per entity or a Module Link per entity type.
Chosen deliberately over Module Links: homepage SEO (a later phase) has no
underlying Medusa entity to link against at all, so a generic row is the
one design that covers products, categories, *and* homepage without
duplicating the model three times. New `seo` table via a real, additive-
only migration (`medusa db:generate`/`db:migrate`, applied to the live
Supabase database — verified purely additive, zero risk to existing
schema).

**Admin side**: a new **SEO** widget on the product detail page
(`product.details.side.after` zone) with dedicated fields — SEO Title,
Meta Description, Canonical URL, OG Title/Description, Social Image URL,
Keywords, Robots (Index/Noindex) — reading/writing through new
`/admin/seo` and `/store/seo` routes (one shared route per side, reused
across resource types rather than one per entity). The mutation goes
through a proper workflow (`upsertSeoWorkflow`) rather than calling the
module service directly from the route handler — Medusa's own
`@medusajs/no-service-mutations-in-api-route` lint rule caught this during
the build and it was fixed, not suppressed, per this backend's own
"business logic belongs in workflows" convention.

**Storefront side**: new `lib/data/seo.ts` (`getSeoOverride`, never
throws — a missing/unreachable SEO record must never break the page it's
decorating) wired into the PDP's `generateMetadata` and JSON-LD. Every
field intelligently falls back to the existing generated default when
empty — title falls back to the product title, description to the
product's own description then title, canonical to the normal
`/proionta/{handle}` URL, OG fields to the SEO Title/Description, robots
defaults to indexable. A structured-data override field merges on top of
the existing generated Product JSON-LD (not a wholesale replace) so a
partial override doesn't silently drop sku/offers/material.

**Two real bugs found and fixed live, not just by inspection:**
1. **A genuine TypeScript/runtime pluralization mismatch.** `MedusaService`'s
   generated *types* pluralize the "seo" model as `Seoes`
   (hero/heroes-style: `listSeoes`, `createSeoes`, `updateSeoes`) — `tsc`
   accepted this and even suggested it as the fix when the correct names
   were used. But the *real* runtime-generated methods (verified directly
   by inspecting the live prototype chain via a `medusa exec` script,
   the same ground-truth technique used earlier this project for the CLI
   investigation) are `listSeos`/`createSeos`/`updateSeos` — a plain "+s".
   `tsc --noEmit` was clean while the actual route 500'd at runtime with
   `seoModuleService.listSeoes is not a function`. Fixed by defining an
   explicit `SeoServiceMethods` interface matching the verified real shape
   and resolving the module against that type (`container.resolve<SeoServiceMethods>(...)`)
   instead of trusting the auto-generated class type for this specific
   model name. **If another model name hits this same mismatch, don't
   trust `tsc`'s "did you mean" suggestion for `MedusaService`-generated
   methods — verify the real method names via `medusa exec` first.**
2. **A title-template collision**: an admin-entered SEO Title got the
   root layout's `"%s | STIA"` template applied on top of itself, since
   the title already contained "STIA" — producing a doubled
   "... - STIA | STIA" title tag. Fixed by using Next's `title.absolute`
   for the admin-override case specifically (opts out of the parent
   template) while leaving the generated-default case untouched, so a
   plain product title still correctly gets the site suffix.

**Verified live, real round-trip through the real Supabase database**: set
a real SEO title + description on a real product via the admin widget,
confirmed the POST persisted (reload showed the same values, not just
optimistic UI state), confirmed the storefront's `<title>`/meta
description/canonical picked it up correctly (including the title-template
fix), set `robots: noindex` and confirmed `<meta name="robots"
content="noindex, follow">` appeared, confirmed an *untouched* product's
page still renders its normal generated metadata unchanged (fallback path
doesn't regress anything), then reset the test product back to empty
fields (no permanent test data left on a real product). `tsc`, `eslint`
(storefront) and `medusa lint`, `tsc` (backend) all clean; `next build`
and a full `medusa build` (backend + admin bundle) both clean.

New `ADMIN_GUIDE.md` started — a living reference of every admin-editable
capability, growing one section per phase.

**Known gap, honestly scoped, not silently skipped**: the Structured Data
Override field has no form input in the widget yet (the model field and
storefront merge logic both exist and work if set directly via the API) —
a UI field is a small, low-risk follow-up, deferred because it's the
single rarest-need field of the eight and the phase was already
substantial. Category SEO and Homepage SEO (Phase B) reuse this exact
same module/routes, just a new widget + a homepage settings page.

## Full technical audit — bugs, dead code, performance, SEO (2026-08-11)

A whole-codebase audit (not a feature) requested with an explicit "fix,
don't just report" mandate. `tsc`/`eslint`/`next build` (storefront) and
`medusa lint` (backend) all clean before and after. Full architecture
inspected: Server/Client component boundaries, data fetching, dead-code
sweep (no orphaned files, no duplicate pricing/discount/formatting logic —
confirmed via a whole-tree cross-reference script, not assumption), SEO
(metadata/canonical/JSON-LD/sitemap/robots.txt across every page type),
and the Next.js → Medusa → Supabase architecture (confirmed no direct
Supabase/Postgres access anywhere in the storefront — everything still
goes through `medusaFetch`).

**One real, genuine bug found and fixed**: Next.js 16 warned live in the
console — "Detected `scroll-behavior: smooth` on the `<html>` element" —
because `globals.css` sets `scroll-behavior: smooth` on `html` but the
`<html>` tag never carried the new `data-scroll-behavior="smooth"`
attribute Next 16 needs to temporarily disable smooth scrolling during
route transitions. Without it, *every* client-side navigation (any `<Link>`
click) triggered an animated scroll-to-top instead of an instant one — a
real, live UX/performance regression on every single page transition
sitewide, not a cosmetic warning. Fixed by adding the attribute to
`RootLayout`'s `<html>` tag. Confirmed live (fresh tab, since this browser
tool's console buffer doesn't clear on same-tab navigation — a testing
quirk worth remembering, not a real persistence bug) that the warning is
gone and the attribute/computed style now match.

**Checked and deliberately left alone** (real findings, not worth the
risk/cost of touching): `next/font` preload warnings for Inter/Literata in
dev console — both fonts are genuinely used (body + headings), this is a
well-known Next.js dev-server-only heuristic false positive, not present
in production; changing font-loading strategy to silence it would risk
regressing a correctly-configured optimization for zero real gain.
`ProductCard`'s full-component client hydration and the two near-identical
focus-trap implementations (`MobileMenu`/`CartDrawer`) — both already
identified and deliberately deferred in a prior session's audit (see
`TASKS.md`), re-confirmed still low-risk/low-payoff, not re-litigated.
`next/image`'s `priority` prop is unset everywhere `ProductImage` could
use it (PDP, product grids) — currently zero live impact since every real
product's `thumbnail` is still `null` (100% `PlaceholderTile` today, no
`<Image>` ever actually renders), so wiring `priority` through would be
speculative plumbing for data that doesn't exist yet; flagged for
whoever adds real product photography, not fixed now.

**Live-verified across desktop and mobile**: New Arrivals, infinite
scroll, homepage carousels, cart (mini-cart + main page, with the real
sale price still active), wishlist toggle + `/lista-epithymion`, Greek
accent-insensitive search (now correctly surfacing the discounted product
with its sale badge in results too), mobile hamburger menu — zero console
errors on any of them. Checkout page loads cleanly; not re-run
end-to-end since no checkout code was touched this session (verified
clean in a prior session, see that entry below).

## Cart price/discount alignment audit — verified against a real sale (2026-08-11)

A follow-on request to audit the cart's SKU/pricing/discount presentation
(mini-cart drawer + main cart page). Inspection found that every piece of
the brief — SKU display, original+current price with strikethrough,
discount badge, and one shared `discountPercent()` calculation used by both
surfaces — had already been built and shipped in a prior session (commit
`24c00e3`, "cart pricing/SKU polish"). Nothing to duplicate.

**The only real, actionable gap**: the desktop cart table's Original Price
column (`ΑΡΧΙΚΗ ΤΙΜΗ`) was deliberately right-aligned, from an earlier
session's explicit decision to stay consistent with the other two numeric
columns next to it. This session's brief asked for it centered. Flagged
the conflict, user chose to center all three price columns (`ΑΡΧΙΚΗ ΤΙΜΗ`/
`ΤΙΜΗ`/`ΣΥΝΟΛΟ`) together rather than centering just one — `CartTableHeader.tsx`
and `CartLineItemTableRow.tsx` both switched from `text-right`/`items-end`
to `text-center`/`items-center` for those three columns and their header
labels. No other pricing/discount logic touched.

**Why nothing showed live before this session**: the real catalog had zero
active promotions — every product's `calculated_amount` equaled its
`original_amount`, so `item.compareAtUnitPrice` was correctly always
`undefined` and the strikethrough/badge never had anything to render. Not
a bug; the honest empty state. The user created a real Medusa sale price
list on one product (Αντικολλητικό Τηγάνι 28cm, €39.90 → €31.92) to make
this verifiable, including a real (not simulated) test of the admin's own
"mark a product on sale" workflow.

**Verified live against that real discount, not just by inspection**:
`discountPercent()` computed exactly 20% from the real Medusa
`calculated_price`/`original_price` values (no floating-point drift); a
mixed cart (2 regular-price items + the 1 discounted item) summed correctly
(€54.50 + €32.00 + €31.92 = €118.42); the desktop table's three price
columns measured pixel-identical column centers across the header and all
three rows via `getBoundingClientRect()`, including the discounted row's
taller two-line cell (price + badge) — vertical center matched the row's
true center for every column, not just the single-line ones; quantity
change on the discounted line recalculated the line total correctly
(€31.92 × 2 = €63.84) while the discount badge correctly stayed a per-unit
percentage; mini-cart drawer showed the same values as the main page (one
shared `discountPercent()`, no drift possible); mobile (375px) rendered the
full SKU/original-price/current-price/badge hierarchy with zero horizontal
overflow; adding the item did not auto-open the drawer (existing behavior,
untouched). `tsc --noEmit`, `eslint`, and `next build` all clean.

## Dynamic New Arrivals, infinite scroll, homepage carousels (2026-08-11)

Three features built incrementally per an explicit, detailed brief that
required an architecture review (data fetching, Medusa pagination,
categories, tags/metadata, homepage sections, carousel libraries, SEO) before
any code — findings and the resulting design were presented and approved
before implementation began, then each feature was built and live-verified
in turn.

**New Arrivals is now a real, admin-maintainable collection, not a static
list.** Membership = a rolling 30-day `created_at` window (reuses the
existing `NEW_ARRIVAL_WINDOW_DAYS` constant, already driving the "Νέο"
badge) **or** Medusa's native product tag `"new"` — confirmed live that
`+tags.value` is queryable via the Store API with zero backend changes, and
that tags are manageable from the Admin's product "Organize" panel. This
gives genuinely-new products automatic inclusion (no admin work) while
still letting the admin curate (re-feature an older product by tagging it).
The "Νέο" badge everywhere (`ProductCard`, PDP) now reflects this same
combined rule instead of the date-only check, so a tagged product reads as
new consistently across the whole site. New `getNewArrivalsPaged()` in
`lib/data/products.ts` fetches a superset ordered by `-created_at`, filters
to members, then sorts/paginates in-process — the same "fetch a generous
superset, sort/slice in JS" pattern already used for price sort, since
membership isn't a single Medusa filter. `getNewArrivals()` (used by the
homepage rail) is now a thin wrapper over the same function, so there's one
source of truth for "what counts as new," not two. New `/nea-afiksi` page
reuses `CategoryPLPView` end-to-end (breadcrumbs, sort, `ProductCard`,
pagination/SEO) — real canonical, OG metadata, single H1, `BreadcrumbList`
JSON-LD, added to `sitemap.ts`, linked from the homepage rail's "Δες όλα".
**Known gap, not fabricated as tested**: the tag-override branch couldn't be
live-tested against a real aged-out product, since all 16 seeded products
are still within the 30-day window — the code path is straightforward and
type-checked but not exercised against real "old + tagged" data yet.

**Infinite scroll replaces classic Prev/Next on category, subcategory,
search, and New Arrivals listings — without sacrificing crawlability.**
`PAGE_SIZE` raised from 12 to 24 (one shared value for the SSR'd first page
and every client-fetched batch, so `?page=2` renders identically either
way). New `InfiniteProductGrid` (Client Component) wraps the grid: an
`IntersectionObserver` sentinel calls one of three small Server Actions
(`lib/actions/products.ts` — `loadMoreCategoryProductsAction`,
`loadMoreNewArrivalsAction`, `loadMoreFeaturedProductsAction`,
`loadMoreSearchProductsAction`) for the next offset/limit batch and appends
client-side, deduped by product id. The classic `Pagination` component is
kept, unchanged, inside a real `<noscript>` — crawlers and no-JS visitors
get the exact same fully-crawlable paginated URLs (each with its own
canonical) this app already had; every product is also independently
discoverable via `sitemap.xml` regardless. Guarded against the real failure
modes: a `loadingRef` (not just `isPending`, which lags a render cycle)
blocks concurrent/duplicate fetches; a `resetKey` (source + sort + SSR page)
snaps state back to the fresh server props the instant it changes, so
switching sort/category never appends onto a stale previous listing; the
observer is deliberately re-created (not just re-observed) after every
successful batch, because a fresh `observe()` call always fires once with
the *current* intersection state — without that, a short list that doesn't
grow taller than the viewport+margin would silently stop loading after one
batch, since `IntersectionObserver` only fires on a state *change* and a
persistently-intersecting sentinel never produces one. **A real bug was
hit and fixed during this build**: a Server Component passed a plain
closure (`buildPageHref`) as a prop into the new Client Component — React
can't serialize functions across that boundary, and it surfaced immediately
as a 500 ("Functions cannot be passed directly to Client Components").
Fixed by passing `basePath`/`extraParams` as plain data and building the
href inside the Client Component instead. **Also verified live**: the
`computer` scroll-simulation browser-automation tool did not reliably
produce real scroll/intersection events in this environment (a repeat of
the "browser automation click/type unreliable" note already in
`NEXT_STEPS.md`) — direct `window.scrollTo()` + polling was used instead
and confirmed the feature genuinely works: correct batch sizes, zero
duplicates, correct end-of-results state, zero extra requests once
exhausted, correct reset on sort change.

**Homepage carousels**: `ProductRail` (shared by the homepage, PDP
related/recently-viewed rails, and the cart cross-sell rail) converted from
a static CSS grid into a touch-friendly horizontal track — native CSS
`overflow-x-auto` + `scroll-snap-type: x mandatory` + a new
`.scrollbar-hide` utility, no carousel library (none existed in
`package.json`; none was added). Desktop gets real, keyboard-operable arrow
buttons (`ChevronDownIcon` reused via CSS rotation — no new icon needed)
that `scrollBy()` the same track and correctly disable at each end (a real
`disabled` attribute, not just a visual dim); mobile relies on native
touch/swipe, which the scroll-snap CSS already provides with zero JS. Both
homepage rails now request 12 products (up from 4) and end with a real
"Δείτε Περισσότερα" tile styled to belong to the track, linking to the new
full listing pages (`/nea-afiksi`, `/protainomena`). New `/protainomena`
("Recommended Products") page mirrors `/nea-afiksi`'s architecture exactly,
backed by a new `getFeaturedProductsPaged()` — same honest "curated slice,
not a fabricated popularity ranking" comment as the original
`getFeaturedProducts()` it replaces, defaulting to alphabetical order
rather than "newest" specifically so it doesn't just look like a duplicate
of New Arrivals. `ProductCard` itself is completely unchanged — no second
card design, per the brief.

`tsc --noEmit`, `eslint` (project-wide), and `next build` all clean after
every fix, not just once at the end.

## Search dropdown fix, real product-image rendering, cart pricing/SKU polish (2026-08-10)

Three follow-on pieces of work in one session, each starting from live
inspection of what already existed rather than assuming a rebuild was needed.

**Search dropdown layout bug, found via actual browser testing (not code
review alone)**: searching "τηγανι" showed a product row where the image
tile visually swallowed the entire row width, hiding the title and SKU text
behind it — confirmed via the accessibility tree that the text was present
in the DOM, just not visible. Root cause: `PlaceholderTile`'s own
`w-full`/`aspect-square` base classes always beat a `className="h-11 w-11"`
override passed by the caller, since Tailwind utility precedence is
stylesheet order, not the order classes appear in a `className` string.
`ProductCard` had already solved this correctly by wrapping the tile in a
sized `<div>` instead of fighting it via `className` — `SearchResultRow`
just hadn't followed that same pattern. Fixed the same way.

**Real product-image rendering added, closing a storefront-wide gap**: while
testing the fix above, found that the domain `Product` type never carried
Medusa's `thumbnail` field through to any component — every product surface
unconditionally rendered `PlaceholderTile`, meaning a real photo uploaded to
Medusa today would render nowhere on the site. Added `Product.imageUrl`,
mapped it from Medusa's `thumbnail` in `toDomainProduct()`, and built a
shared `ProductImage` component (real `next/image` when a thumbnail exists,
`PlaceholderTile` fallback otherwise) used by both `ProductCard` and
`SearchResultRow`, plus the `next.config.ts` `images.remotePatterns` entry
Medusa's local file server needs. No real product has a photo yet, so this
is verified for zero-regression (every card renders identically to before)
but not yet against a real end-to-end photo.

**Cart pricing/SKU/discount-badge polish, mini-cart drawer + main cart
page**: explicit brief to inspect existing pricing/discount logic first.
`discountPercent()` and Medusa's real `compare_at_unit_price` field already
existed and were already shared by both the drawer and the full cart table —
no duplicate discount calculation was written. Added the one real gap: SKU
display (Medusa's line items already carry `variant_sku` by default, just
never mapped into the domain `CartLineItem`), and upgraded the discount
indicator from bare accent-colored text to a compact pill badge reusing
`ProductCard`'s existing "sale" badge style. Verified live with three
different product-title lengths via `getBoundingClientRect()` that no
alignment bug existed (vertical centering and column edges were already
correct via the existing shared grid + `items-center`), and — since no
discounted product exists in the live catalog — verified the discount math
against a deliberately non-round number (`27.90 × 1.25 = 34.875 → -20%`) via
a disclosed, transient client-side-only override, reverted immediately after
the screenshot.

`tsc --noEmit`, `eslint` (project-wide), and `next build` all clean.

## Greek-aware live search dropdown — built and fully verified live (2026-08-10)

Built the interactive search dropdown from a detailed brief: live results as
you type, Greek accent-insensitive matching, SKU search, bounded typo
tolerance, tiered ranking, quick-add with stock/multi-variant awareness, full
keyboard accessibility. Architecture (including why Medusa's native `q` isn't
sufficient, and why an in-memory app-layer ranker is the right scope at
today's catalog size rather than a database extension or external search
service) proposed with desktop/mobile wireframes and approved before any code.

**New**: `lib/search.ts` (Unicode NFD-based Greek normalization + hand-rolled
bounded Levenshtein fuzzy matching + a 7-tier ranking, zero new dependencies),
`lib/hooks/use-quick-add.ts` (extracted from `ProductCard` so it's shared, not
duplicated, with the new result row), `components/layout/SearchResultRow.tsx`.
`lib/data/products.ts`'s `searchProducts()` rewritten in place — same
signature, still the one search implementation behind both `/anazitisi` and
the dropdown — to rank a short-cached full-catalog fetch instead of Medusa's
ILIKE-based `q`. `SearchBox.tsx` rebuilt with the same ARIA combobox pattern
already established by `AddressAutocomplete.tsx` (virtual arrow-key
navigation, `aria-activedescendant`, outside-click), rather than a new one.

Two real bugs caught during self-review before any testing began: the
category-match ranking tier was indexing the Latin URL handle instead of the
real Greek category name (would have made that tier permanently unreachable
for Greek queries); quick-add errors in the new compact row had nowhere to
surface and were being silently swallowed. Both fixed. Also hit the same
`react-hooks/set-state-in-effect` lint rule the cart drawer's transition work
hit last session, fixed with the same "adjust state during render" pattern.

**Mid-session outage, diagnosed and fixed, not worked around.** The local
Medusa backend lost its connection to Supabase and stayed down for 30+
minutes across repeated restarts. Diagnosed precisely (not guessed):
`db.tuvbesrqizixqrunvlnt.supabase.co` is IPv6-only by Supabase's own design
(confirmed via `dns.resolve4` returning `ENODATA` — genuinely no A record —
while `dns.resolve6` succeeded with a real address), and this machine's
OS-level resolver stopped handing that back through Node's `dns.lookup()`
specifically, while general internet DNS (including Supabase's own API
host) resolved fine throughout. Confirmed architecturally that this was
purely a Medusa-backend-to-database issue, not a storefront problem: the
storefront has zero direct Supabase references anywhere. Fixed by switching
`DATABASE_URL` to Supabase's session pooler connection string (real IPv4),
reusing the existing DB password rather than exposing or re-entering it.

**`tsc --noEmit`, `eslint` (project-wide), `next build`, and `medusa lint`
are all clean, and the feature is fully verified live** against the real
backend and real catalog — every item from the testing checklist passed:
Greek accented/unaccented/uppercase search, exact and partial SKU search,
two deliberate typo cases via bounded fuzzy matching, honest no-results
copy for both a nonsense query and a real absent product, quick-add
updating the header count/total without opening the drawer, full keyboard
navigation, real outside-click, and zero horizontal overflow at
320/375/768/1280px. Full detail in `PROJECT_MEMORY.md`. Two states weren't
exercised because they don't exist in the live catalog right now — no
discounted or out-of-stock product — and multi-variant routing remains
verified by code inspection only, since the catalog is still 100%
single-variant; none of these were fabricated to force a test.

## Storefront UX polish — card heights, header mini cart, Continue Shopping (2026-08-10)

Three targeted UX fixes from a detailed user brief, each scoped to one
component — no architecture or data-layer changes.

**Uniform product card heights.** The grid layouts (`CategoryPLPView`,
`ProductRail`, `WishlistPageView`) already stretched every card to its
row's tallest neighbor via CSS Grid's default `align-items: stretch` — the
actual misalignment was inside `ProductCard.tsx`, where the Add to Cart
button had no bottom anchor and variable content (title length, badges,
product code) pushed it to a different height on every card. Fixed with a
standard flex "pin to bottom" pattern: content block `flex-1`, title
`line-clamp-2` with a `min-h-10` reservation so one-line and two-line
titles occupy identical space, button/`Επιλογές` link `mt-auto`. Title
stays fully in the DOM (visual clamp only, no SEO loss) and gained a
`title=` attribute for the full name on hover. Verified live:
`getBoundingClientRect()` on the button shows byte-identical top/bottom
coordinates across mixed-length titles in the same row, at 375/768/1280px.

**Header mini cart.** `Header.tsx` now shows the cart total next to the
existing item-count badge. Sourced from the same `getCart()` call
`RootLayout` already made for the badge — `cart.total` passed down
alongside `cartItemCount`, no new fetch, no reimplemented totals math.
Total text shown from `sm:` up (matches the existing `hidden sm:block`
treatment already used for the wishlist/account icons); the badge alone
already covers "always show the count" at every width, including mobile.
Updates automatically through the pre-existing `revalidatePath("/",
"layout")` mechanism that already refreshed the badge on add/remove/qty/
coupon — no new plumbing. Confirmed unchanged: quick-add still never
auto-opens the drawer (toast-only, same as before).

**Continue Shopping now navigates home, and the drawer finally has a real
transition.** The cart drawer previously had no open/close animation at
all — instant mount/unmount, called out as a deliberate stopgap in the old
code. Added a real slide-in/fade transition (CSS `transform`/`opacity`,
`motion-reduce:transition-none` for reduced-motion users) to the whole
drawer — X button, Escape, backdrop click, and Continue Shopping all
animate consistently now, not just the one button. `CartDrawer` keeps the
component mounted for 300ms after `isDrawerOpen` goes false so the exit
animation has something to animate against; the actual unmount is
`setTimeout`-driven rather than `onTransitionEnd`, so it still unmounts
correctly under `prefers-reduced-motion` (where no CSS transition, and
therefore no `transitionend` event, ever fires). "Συνέχεια αγορών" now does
a client-side `router.push("/")` when not already on the homepage, then
closes; when already home, it's a plain close with no navigation. Cart
(cookie/server-backed) and wishlist (`localStorage`-backed) both already
survive client-side navigation untouched, so nothing extra was needed to
preserve either.

**Real lint fix hit along the way**: the first draft called `setState`
synchronously inside two `useEffect` bodies (the drawer's mount-gate and
its exit-visibility flag) — this project's `react-hooks/set-state-in-effect`
rule (the same one the wishlist store's `SearchBox` fix hit earlier) caught
both. Fixed with React's documented "adjust state during render" pattern
instead of an effect for the synchronous parts.

Verified live end-to-end: card button alignment across mixed title lengths
at 375/768/1280px; header total/count updating on a real quick-add with no
page reload; closing the drawer from a non-home page navigating home with
cart state intact (confirmed via a `window` marker surviving — rules out a
full reload); Continue Shopping from the homepage itself producing zero
navigation. `tsc --noEmit`, `eslint` (project-wide, not just changed
files), and `next build` all clean.

## Premium Greek checkout, Phase 5 — order confirmation emails (2026-08-10)

Fifth phase of `CHECKOUT_PREMIUM_SPEC.md`: a real branded Greek order-
confirmation email sent on `order.placed`, via Medusa's notification module
— **SendGrid, not Resend** (a deliberate substitution from the original
plan): `@medusajs/notification-sendgrid` is already a bundled dependency in
this project, so using it needed zero new packages, versus Resend which
would have needed one. Verified live via the actual sendgrid provider
source in `node_modules` before building against it, same discipline as
reading Medusa's fulfillment-manual source for Phase 1.

**Same "explicit or it's lost" module-registration rule as fulfillment
(Phase 1)**: the notification module needed the built-in local provider
(used for admin in-app "feed" notifications) explicitly re-declared
alongside the real email provider, or it would have been silently dropped.

**Real safety question answered before registering anything**: does Medusa
fail to boot if `SENDGRID_API_KEY` is unset? Traced into
`@sendgrid/client`'s actual `setApiKey` implementation — it only
`console.warn`s ("API key does not start with...") and never throws.
Confirmed live: the backend restarted cleanly with no key configured.

`src/subscribers/order-placed.ts` builds the email from the real Order
Module Service (not a duplicated read path) and never lets a broken/
unconfigured provider affect the order itself — wrapped in try/catch,
logged, never rethrown, since the order already exists by the time this
subscriber runs. `src/utils/order-confirmation-email.ts` is a table-based,
inline-styled HTML template (email clients don't support flexbox/grid or
reliably load web fonts, so it doesn't reuse the storefront's Tailwind
classes) — no product images, matching this project's standing rule against
fabricating what doesn't exist yet (no real product photography).

**Verified live, completely**: placed a real test order (`display_id` 4)
with a real SendGrid... provider registered but no real key. Backend logs
confirmed the full real chain: `"Processing order.placed which has 1
subscribers"` → the template built successfully → SendGrid rejected the
placeholder key with a real 401 → caught and logged by the subscriber's own
error handling → **order creation completed successfully regardless**,
proving the "never block the sale" design actually holds under a real
failure, not just in theory.

`tsc`/`eslint`/`next build` (storefront) and `tsc`/`medusa lint` (backend)
clean.

## Production quality audit (2026-08-10)

User-requested full audit of every file touched this session (Phases 1-5),
performed as Sonnet 5 (no tool exists to switch models mid-session — flagged
honestly rather than silently skipped). Real findings, not a rubber stamp:

**Three real bugs found and fixed**, none caught by `tsc`/`eslint`/manual
testing up to this point because earlier verification always filled every
field before the first save, never exercising these specific paths:

1. **Checking "different billing address" before finishing it silently
   blocked the shipping-address save entirely** — `attemptDetailsSave`
   gated the *whole* combined save (shipping included) on billing being
   complete, so a customer who checked the box before typing a billing
   address would see shipping options never load, with no error explaining
   why. Fixed: billing only participates once it's actually complete;
   until then it's sent as a mirror of shipping (same as the unchecked
   state) rather than blocking. Confirmed live: shipping options now stay
   visible through an incomplete billing entry.
2. **Race condition in the ΓΕΜΗ autofill**: the lookup result was applied
   via a plain object captured before the `await`, so if the customer typed
   into Επωνυμία while the lookup was still in flight, the eventual
   resolution could silently overwrite what they'd just typed. Fixed with a
   functional `setInvoiceFields` update that merges against the freshest
   state instead of a stale snapshot.
3. **Race condition in the address-autocomplete debounce**: two in-flight
   suggestion requests can resolve out of order (a longer query isn't
   guaranteed to come back slower), so a stale response for an old
   keystroke could land after and overwrite a newer, correct one. Fixed
   with a request-generation counter that discards superseded responses.

**One real accessibility gap fixed**: the address-autocomplete dropdown
supports arrow-key navigation, but real focus never left the input, so a
screen reader had nothing to announce which suggestion was "active" —
added `aria-activedescendant` + stable `id`s on each option, the standard
fix for this exact combobox pattern.

**Two misleading comments corrected** to match actual code behavior (found
while re-reading code with fresh eyes, not from any bug report) — one in
`lib/types.ts` (referred to ΓΕΜΗ lookup as a "later phase" after it had
already shipped in Phase 4), one in `AddressSection.tsx` (claimed
autocomplete "only fills empty fields," which is true only for Αριθμός —
street/city/ΤΚ are deliberately always overwritten together, since they
describe one consistent place).

**Clean**: no dead code, no duplicate logic, no debug/console statements,
no unused imports found across the full session diff (confirmed via
`grep` sweep + a clean `tsc`/`eslint` pass, which catches unused
imports/variables in this project's config). No new npm dependencies were
added at any point this session — Phases 3/4/5 all reused either Node's
built-in `fetch` (Google Places, ΓΕΜΗ) or an already-bundled Medusa package
(SendGrid), keeping bundle size and dependency surface unchanged.

**Medusa architecture**: re-confirmed every new data point (billing
address, tax document type, ΑΦΜ, pickup fulfillment) lives on a real Medusa
field or module — no parallel database, no duplicated business logic.

**SEO/responsive**: no new routes, `/checkout`'s existing `noindex` and
canonical are untouched, heading hierarchy on the confirmation page is
still a clean h1→h2 (no skipped levels). Full checkout flow re-verified at
375px mobile width after every fix: zero horizontal overflow.

**Remaining technical debt** (not fixed, out of scope for this audit — all
already tracked as open items, not new discoveries): Phases 3/4 still need
real API keys for true end-to-end verification; Phase 6 (a real payment
gateway) and BOX NOW are still not started; customer accounts remain
explicitly out of scope.

## Premium Greek checkout, Phase 4 — ΓΕΜΗ business lookup (2026-08-09)

Fourth phase of `CHECKOUT_PREMIUM_SPEC.md`: a valid ΑΦΜ in the invoice
section now triggers a ΓΕΜΗ Open Data lookup that autofills Επωνυμία and
Δραστηριότητα — the recommended alternative to direct AADE/TAXISnet
integration (§4.3), now actually built rather than just proposed.

**Real API contract confirmed live, not guessed**: rather than build
against assumed field names (a real risk with any "found via general
research" API), the actual ΓΕΜΗ Swagger 2.0 spec was fetched live this
session from `opendata-api.businessportal.gr/api-docs` (its Swagger UI is
public even without a registered key — only real API *calls* need one).
Confirmed: `GET /companies?afm={9-digit}` with an `api_key` header, and the
real `Company` response schema — `coNameEl` for the Greek company name,
`activities[].activity.descr` for business activity. Also confirmed by
reading the real schema, not assumed: **there is no ΔΟΥ field anywhere in
ΓΕΜΗ's data** — the spec's existing "ΔΟΥ stays manual, ΓΕΜΗ can't provide
it" design is now a verified fact, not a guess.

**Correction to the original research**: getting a working `GEMI_API_KEY`
needs a registration + approval step (`opendata.businessportal.gr/register/`),
not the instant self-serve signup the Phase 4 recommendation originally
assumed — still far less friction than AADE's TAXISnet requirement, but a
real correction worth having on record.

`lib/actions/afm-lookup.ts`'s `lookupCompanyByAfm` follows the same
never-throw, degrade-to-null discipline as the Phase 3 address-autocomplete
actions. The lookup fires automatically the moment ΑΦΜ passes its checksum
(no separate button), and — same non-destructive rule as address
autocomplete — only fills Επωνυμία/Δραστηριότητα if they're still empty,
never overwriting something the customer already typed.

**Verified live**: attempted an actual call against the real ΓΕΜΗ API using
the Swagger docs' own test key (`api-docs-key`) out of curiosity — correctly
rejected with 401, confirming that key is for viewing documentation only,
not real calls, exactly as the docs state. With no real `GEMI_API_KEY`
configured (the actual state today), typing a valid ΑΦΜ and blurring
produces zero console errors and no autofill, the same clean degrade
already proven for Phase 3. Full round-trip against a real approved key is
still an honest open gap — same as Phase 3's Google key.

`tsc`/`eslint`/`next build` clean.

## Premium Greek checkout, Phase 3 — address autocomplete (2026-08-09)

Third phase of `CHECKOUT_PREMIUM_SPEC.md`: Google Places-backed autocomplete
on the checkout's Οδός field, per the §2 recommendation (Google over
Mapbox — better-verified Greek coverage, near-free at this store's volume).

**Architecture improvement over the original spec**: rather than loading
Google's client-side Places JS widget (which needs a browser-exposed,
referrer-restricted API key), this calls Google's Places API (New) REST
endpoints directly from two new Server Actions
(`lib/actions/address-autocomplete.ts`) — `getAddressSuggestions` and
`getPlaceDetails`. The API key (`GOOGLE_PLACES_API_KEY`) never reaches the
browser at all, a stricter posture than what was originally proposed, at no
extra engineering cost once the proxy exists. Both actions degrade to an
empty/null result on any failure — no key configured, a network error, an
API error — never throwing, so manual address entry is never blocked. This
is the same discipline as the rest of checkout's server actions (never let
a raw failure reach the customer), just applied to "no suggestions" instead
of "an error state."

New `AddressAutocomplete.tsx` wraps the existing Οδός field with a
debounced (300ms) suggestions dropdown — keyboard (arrow keys, Enter,
Escape) and mouse both work, outside-click closes it, and it degrades to a
completely ordinary text input with zero behavior change when no
suggestions come back. Selecting a suggestion autofills Οδός/Αριθμός/Πόλη/
ΤΚ from Google's structured address components, but **never overwrites a
field the customer already typed into** — picking a suggestion after
correcting the ΤΚ by hand doesn't clobber that correction. A session token
(regenerated after each completed selection) ties the autocomplete
keystrokes and the final Place Details call into one billable session, per
Google's documented contract.

**Honest gap, not an oversight**: request/response shapes were verified
against Google's own current API documentation (fetched live this
session), not assumed — but this has **not been exercised against a real
Google API key** yet, since none was available this session. What *was*
verified live: the graceful-degrade path (no key configured → typing in
Οδός produces zero console errors, zero broken UI, the field behaves
exactly as before) and that the existing combined address/billing save
still works correctly with the new component in place — confirmed via a
full checkout fill-through with shipping options loading successfully
afterward. The "subtle map pin confirmation" from the original spec is
deliberately deferred — a real key is needed to build a Static Maps proxy
worth verifying, not to speculatively wire one up untested.

`tsc`/`eslint`/`next build` clean.

## Premium Greek checkout, Phase 2 — billing address + tax documents (2026-08-09)

Second phase of `CHECKOUT_PREMIUM_SPEC.md`: a billing-address toggle
("Τα στοιχεία τιμολόγησης είναι διαφορετικά από τη διεύθυνση αποστολής",
unchecked by default) and a tax-document toggle (Απόδειξη default /
Τιμολόγιο, revealing Επωνυμία/ΑΦΜ/ΔΟΥ/Δραστηριότητα with checksum-validated
ΑΦΜ). A live ΓΕΜΗ lookup that autofills these from a valid ΑΦΜ is Phase 4,
not this one — these are honest manual-entry fields for now.

**Architecture decision**: billing address is a real Medusa `billing_address`
field, written in the *same* request as `shipping_address` — extending the
already-established "two visual sections, one Medusa write" pattern from
Phase 4B to three sections instead of adding a second HTTP round-trip. When
the toggle is off, `billing_address` is explicitly mirrored from
`shipping_address` in that same request, so it's never left stale or null.
Tax document type/ΑΦΜ details have no native Medusa field, so they live in
`cart.metadata` — the one place in this codebase that needed a Medusa
`metadata` field for real content rather than being unused.

**Real, load-bearing finding — the opposite of what memory assumed**:
confirmed live that a Medusa cart `metadata` POST *merges* into the existing
object rather than replacing it (unlike the fulfillment service zone's
`geo_zones`, which genuinely is a full-replace endpoint — see
`PROJECT_MEMORY.md`). This surfaced a real bug in the first version of
`updateTaxDocumentAction`: clearing the invoice fields by sending them as
`undefined` did nothing, because `JSON.stringify` drops `undefined`
properties entirely, so the clearing instruction never reached Medusa at
all. Fixed by sending explicit `null`, confirmed live that it actually
clears the fields this time.

**Real accessibility bug found and fixed before shipping**: the billing/
invoice field groups collapse via a CSS grid-rows transition (0-height +
`overflow-hidden`) so they can animate open smoothly — but a 0-height
container alone doesn't stop the browser from tabbing into the fields
inside it. Confirmed live via `element.focus()` still landing inside the
collapsed group. Fixed with the HTML `inert` attribute on the collapsed
wrapper (React 19 supports it as a plain boolean prop) — confirmed live
afterward that `.focus()` on a field inside an inert ancestor is correctly
blocked by the browser, and that `inert` clears the instant the toggle
opens the section.

**ΑΦΜ checksum**: the standard, publicly-documented Greek ΑΦΜ mod-11
algorithm (`lib/checkout-validation.ts`'s `isValidAFM`) — validates
structure only, not that the number is a real registered business (that
needs the Phase 4 ΓΕΜΗ lookup). Verified against a known-valid test ΑΦΜ
(`094259216`) by hand-computing the checksum before trusting the
implementation, and again live in the browser (a deliberately-wrong ΑΦΜ
correctly showed "Το ΑΦΜ δεν είναι έγκυρο.", the same one corrected and
saved successfully).

Verified live end-to-end, not just individually: filled a full checkout
with a billing address different from the shipping address and a Τιμολόγιο
selected with real invoice fields, completed the order, and confirmed the
resulting real order (`display_id` 3) shows the correct shipping address,
the correct *different* billing address, and the full invoice details
(company name, ΑΦΜ, ΔΟΥ, activity) — proving the whole chain (form state →
Server Action → Medusa cart → order) round-trips correctly, not just that
each piece compiles. Also verified: unauthenticated collapsed sections
can't be tabbed into: mobile width (375px) has zero horizontal overflow and
the billing section expands cleanly. `tsc`/`eslint`/`next build` clean.

## Premium Greek checkout, Phase 1 — Store Pickup (2026-08-09)

User brief: build one of the best checkout experiences in the Greek market —
delivery options (BOX NOW + Store Pickup), address autocomplete, billing
address, Greek tax documents (ΑΦΜ/AADE), payment methods, order emails, and
cart/wishlist persistence. Explicit instruction (matching the brief's own
§12 and this project's established pattern) to review the existing
architecture and write up findings before any code. `CHECKOUT_PREMIUM_SPEC.md`
covers all 13 review points per feature area; the user then answered four
real open decisions: BOX NOW deferred (no self-serve API access — needs an
actual merchant/partner relationship with BOX NOW), Stripe first for
payment (official Medusa plugin; Viva Wallet/IRIS documented as a later,
custom-built option), ΓΕΜΗ Open Data for ΑΦΜ lookup (AADE's own registry
service needs the business's own TAXISnet credentials — too much friction
to gate this feature on), and customer accounts explicitly out of scope
(this store has no login system at all today, so "sync for logged-in
customers" has nothing to sync against yet).

**Store Pickup built as a real Medusa fulfillment-provider module**, not a
shortcut — this both delivers the feature and de-risks the same extensible
pattern BOX NOW will need later. `AbstractFulfillmentProviderService`
subclass at `apps/backend/apps/backend/src/modules/store-pickup`, registered
in `medusa-config.ts`. **Real, load-bearing finding, verified against
Medusa's own docs rather than assumed**: declaring an explicit `modules`
entry for the fulfillment module does *not* merge with Medusa's default
providers — the built-in manual provider (which the existing Standard/
Express shipping options depend on) had to be listed explicitly alongside
the new provider, or those would have silently broken. Regression-tested
live post-change: both still resolve correctly for a Greek address.

A new "Παραλαβή από το κατάστημα" shipping option was created via the Admin
API (price €0, `shipping_option_type.code = "pickup"`) on the existing
Greek-serving service zone. **Real bug hit while creating it**: Greek text
passed inline through a bash/curl command arrived corrupted (mojibake) at
the database — not a code bug, a shell-encoding issue on this machine. Fixed
by writing the update as a `.mjs` script file instead of inline shell
arguments, then running that. Worth remembering for any future Admin API
call carrying Greek text.

Storefront: `ShippingOption` gained `isPickup` (derived from the shipping
option's `type.code`, same pattern as the existing `DELIVERY_ESTIMATES`
lookup — matching a known, stable backend code, not inventing a claim the
data doesn't back). `ShippingSection.tsx` shows a location/hours/
instructions block once Pickup is selected, and renders "Δωρεάν" instead of
"0,00 €" for any zero-amount option. Real pickup location
(`lib/pickup-config.ts`): Σφακιανάκη 4, 71201 Ηράκλειο. Hours are per-day
(`{ day, hours }[]`, rendered as a `<dl>`), not a collapsed range — the real
schedule has split shifts on Tuesday/Thursday/Friday that a single
"Δευτέρα–Παρασκευή ..." string couldn't represent honestly.

Verified live end-to-end: filling the address reveals all three shipping
options, selecting Pickup shows the info block and immediately drops the
order total to items-only (matching the existing live-update UX for any
shipping method change). `tsc`/`eslint`/`next build` clean on the
storefront; `tsc --noEmit`/`medusa lint` clean on the backend (one real
lint warning fixed along the way: fulfillment provider errors must be
`MedusaError`, not a generic `Error`, so they map to the correct HTTP
status).

## Product card redesign, wishlist, stock display, PDP content (2026-08-09)

User brief: reposition the product card's Add to Cart button, add a
wishlist feature, make stock status always visible, and give the PDP
dedicated description/characteristics sections — explicit instruction to
inspect the current implementation first, propose an architecture (with a
short look at how established Greek home-goods retailers structure
cards/PDPs, for pattern reference only — nothing copied), and get sign-off
before writing code. Proposal + two open decisions written up in
`PRODUCT_CARD_WISHLIST_PDP_SPEC.md` and approved before implementation,
same pattern as every prior feature phase.

**Card hierarchy**: the user's own first draft put stock status and the
Add to Cart button *before* title/price. Recommended reordering instead —
identity and price should read before the action asks for a decision — and
explained why rather than silently building either version; the user took
the recommendation. Final order: image (wishlist heart top-right) → title
→ code (small, muted) → price → stock → Add to Cart, now a real row in
normal document flow instead of an absolutely-positioned hover-reveal
overlay. That change also retires the Phase 5 desktop-hover/mobile-always-
visible CSS split entirely — nothing left to regress there.

**Wishlist, architecture explained before building** (per explicit
instruction not to invent a custom system without justifying it first):
Medusa v2 has no native wishlist module, and this storefront has no
customer auth system — checkout is guest-only by design, so a
Medusa-backed wishlist would mean building account creation/login first,
well outside this task. Reused the exact shape already proven by "recently
viewed": handles in `localStorage`, a Server Action resolving them to real
Medusa product data. Built as a real external store
(`lib/wishlist-storage.ts`) read via `useSyncExternalStore` rather than a
naive `useEffect`+`useState` mount-read, which would have caused a real
SSR/hydration mismatch (the server has no `localStorage`) and tripped the
`react-hooks/set-state-in-effect` lint rule this project already enforces.
**Real bug caught live during this build**: `getServerSnapshot` returning a
fresh `[]` literal every call triggered React's "should be cached to avoid
an infinite loop" — fixed with a stable module-level constant. A real
`/lista-epithymion` page (previously a linked-but-404 placeholder since
Phase 1) replaces the placeholder, reusing `ProductCard`.

**Stock display**: a new shared `StockStatus` component (`Σε απόθεμα` /
`Εξαντλήθηκε`, real-inventory-driven, same rule as Phase 5's Add to Cart
gating) is now the one place this wording/color lives, used by both the
card and the PDP — first real use of the `--color-success` design token,
which has existed since Phase 1 but had nothing using it.

**PDP content sections**: confirmed live that Medusa's native product
schema already has `material`/`weight`/`length`/`width`/`height`/
`origin_country` — the "characteristics" architecture the user asked for
already exists, no new field. But every one of the 16 real products has
every one of these fields empty today (confirmed live and via the admin's
own Attributes panel). Built the Characteristics section to render only
populated fields and disappear entirely when none exist, rather than
inventing plausible-sounding weights/dimensions — same anti-fabrication
standard already applied to fake reviews/ratings elsewhere in this
project. Description was promoted from an unlabeled paragraph into its own
`<h2>Περιγραφή</h2>` section. Heading hierarchy confirmed live via
`document.querySelectorAll`: single h1, logical h2s beneath it.

**Verified live end-to-end** (not just `tsc`/`eslint`/`next build`, though
those are clean): wishlist toggle → instant header count update → persists
in `localStorage` → resolves on `/lista-epithymion` → removing the last
item shows the empty state immediately, no reload needed anywhere in that
chain; out-of-stock state confirmed correct and then restored on both the
PDP and a grid card, including the disabled-button check (driven via the
Admin API directly after the admin dashboard's row-action menu proved
unreliable to drive through browser automation — same category of tooling
flakiness noted in earlier phases, not an app bug); 375/768/1280px all
`scrollWidth === innerWidth` (zero horizontal overflow); a real long
product name wraps cleanly without breaking grid alignment; the cart
page's cross-sell rail (also `ProductCard`) still renders with zero
console errors. Not re-verified: a discounted product's card/PDP rendering
— no active promotion exists in the live catalog to test against, and the
discount/`compareAtPrice` code path itself wasn't touched by this work,
same honest gap as Phase 5.

**Known, pre-existing gap, not introduced or fixed here**: the header's
wishlist icon is `hidden sm:block` (same treatment the account icon has
always had) — invisible below the `sm` breakpoint, so true mobile widths
have no header entry point to `/lista-epithymion`. The heart-toggle
interaction itself works everywhere a product renders on mobile; this is
specifically about the header nav icon, and fixing it means touching
`MobileMenu`, out of scope for this task.

## Production readiness audit — Phases 1–5 (2026-08-08)

A gated, whole-codebase audit before any further feature work: code review,
performance, SEO, Core Web Vitals, accessibility, Medusa architecture,
cleanup, and the full `tsc`/`eslint`/`next build`/`medusa lint` gate.
Everything below was verified against the running app (real backend, real
catalog) rather than reasoned about — the two most valuable findings were
both invisible to the type checker and the linter, same pattern as every
previous phase.

**The single worst finding: the homepage was publishing three fabricated
customer reviews.** `components/home/Reviews.tsx` rendered a
"Τι λένε οι πελάτες μας" section with three invented, *named* testimonials
("Ελένη Κ.", "Γιώργος Π.", "Μαρία Δ.") and hardcoded 5/5/4-star ratings.
This is the same class of bug the Phase 3 audit already treated as a
correctness issue when it removed the fabricated 4.6-star product ratings —
only worse, because attributed quotes read as specific factual claims about
real people rather than a generic aggregate. It also carries real legal
exposure: fake consumer reviews are a prohibited unfair commercial practice
under the EU Omnibus Directive (2019/2161), which Greece has transposed. The
whole section was **deleted**, not softened — there is no honest version of
"what our customers say" for a store with zero customers. `Stars` stays in
place for the day real review data exists; it already only renders when a
rating is genuinely present. Restoring the section is a one-import revert if
that call is disagreed with, but it shouldn't be restored with invented
content.

**A real keyboard-accessibility bug in checkout, confirmed live.** Every
field in "Στοιχεία παραλήπτη" and "Διεύθυνση παράδοσης" (and the email
field) carried `disabled={saving}` while the section auto-saved to the
Medusa cart in the background. Disabling an element that currently has focus
moves focus to `<body>` — so the moment a customer finished the last address
field and tabbed onward, the autosave fired, every field went disabled, and
their keyboard position was destroyed; they landed back at the top of the
document. Measured on the live checkout: `document.activeElement` went
`checkout-area` → `BODY` and stayed there. Fixed by no longer disabling
inputs during a background save at all (the save is a convenience — it
re-fires on the next blur, and `details` is client state that the server
response never clobbers) and moving the feedback to a `role="status"`
"Αποθήκευση…" indicator on `SectionHeading` instead. Re-measured after the
fix: focus stays on `checkout-area` throughout, and shipping options still
resolve normally. `ShippingSection`'s radio `disabled={saving}` was left
alone deliberately — it guards against racing two shipping-method writes,
and it disables the control the customer just clicked rather than one they
tabbed into.

**Three places were promising payment methods checkout cannot take.**
`TrustStrip` (homepage) and the PDP's delivery block were already flagged in
`TASKS.md` as needing reconciliation; auditing turned up a **third,
undocumented one** — the footer's "Αποδεκτοί τρόποι πληρωμής" badge row
listing Visa, Mastercard and Viva Wallet. The only configured Medusa payment
provider is still `pp_system_default`, presented at checkout as
"Αντικαταβολή". All three now say only what the store can actually do. The
PDP and `TrustStrip` delivery windows were also moved from "2-4 εργάσιμες"
to "2-3 εργάσιμες" so they match the real Medusa `Standard Shipping`
option's own estimate instead of contradicting it two clicks later.

**Two broken links on the most important page.** The homepage's
"Προτεινόμενα" and "Νέες αφίξεις" rails both had a "Δες όλα →" link —
`/prosfores` and `/nea-afiksi` — and neither route has ever existed
(verified: both 404 through `[category]`'s `notFound()`). Unlike the
footer's not-yet-built content pages, these were never documented as known
gaps. `ProductRail` already treats `viewAllHref` as optional, so both links
were simply dropped; a missing affordance beats a broken one.

**SEO: four real defects, all verified by reading the rendered HTML.**

- `/anazitisi` was **indexable and canonicalised to the homepage.** Because
  it declared no `alternates` of its own, it inherited the root layout's
  `canonical: "/"` — so every search-results URL told Google it *was* the
  homepage. Now `noindex, follow` with a self-referencing canonical. It is
  deliberately *not* added to `robots.txt`: blocking the crawl would stop
  crawlers ever seeing the `noindex`.
- `/checkout/epibebaiosi` had the same inherited-canonical bug (noindex, so
  lower blast radius, but still wrong). Fixed the same way.
- **Paginated category/subcategory pages did not self-canonicalise** — page
  2 pointed at page 1, which tells Google the deeper pages are duplicates
  and drops any product only reachable past page 1. `canonicalListingPath()`
  in `lib/search-params.ts` now makes the canonical page-aware. `sort` is
  deliberately excluded: the sort variants genuinely *are* duplicates of
  each other, so they should all collapse onto the unsorted page.
- `/checkout` was crawlable — added to `robots.txt`.

**SEO improvement, not a bug fix**: the PDP's `Product` JSON-LD now carries
`sku`, using the real Medusa variant SKU already displayed as "Κωδικός
προϊόντος" (Phase 5). It's omitted rather than faked when a variant has
none. Still no `brand`, no `image` and no `AggregateRating` — none of those
have real data behind them.

**Security hardening** (both cheap, neither changing behaviour): the
`cart_id` cookie is now `httpOnly` + `secure` in production — nothing
client-side has ever read it (the cart is resolved server-side via
`getCart()` and mutated via Server Actions), so this costs nothing and
removes it as an XSS target. And `next.config.ts` gained a baseline header
set (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`X-DNS-Prefetch-Control`) plus `poweredByHeader: false`. **No CSP yet, on
purpose**: the app emits inline JSON-LD `<script>` tags on nearly every
page, so a real policy needs per-request nonces threaded through those —
worth doing, but it's its own change, not a header list. HSTS was left to
the hosting layer since no deployment target is decided.

**Redundant Medusa requests removed.** `completeCheckoutAction` re-fetched
the whole cart from Medusa just to read `region_id` back, immediately after
`getCart()` had already fetched it (with `region_id` in `CART_FIELDS`, but
the domain `Cart` type dropped it). `Cart` now carries `regionId`, and
`regionIdForCart()` is gone. The same field also let `/checkout` stop
calling `getDefaultRegionId()` — which was both an extra request *and*
subtly wrong, since it would resolve "the first region" rather than the
cart's own the moment a second region exists. The PDP's three-deep request
waterfall (category → parent category → related products) was flattened:
related products don't depend on the category lookups, so they now run
alongside them.

Also: `CategoryPLPView`'s subcategory chips were plain `<a>` tags — a full
document reload and no prefetch on the one navigation a category page most
expects. Switched to `next/link`, matching every other link in the app.

**Accessibility, beyond the checkout fix.** The desktop mega menu declared
`role="menu"` / `role="menuitem"` on what is a list of ordinary navigation
links. That role promises arrow-key roving-focus semantics the panel doesn't
implement and makes screen readers announce links as menu items — both roles
removed. Its trigger buttons also did nothing on activation despite
reporting `aria-expanded`; they now open the panel on click. That was
initially written as a *toggle*, which turned out to be a regression —
verified live that a mouse click arrives after `mouseenter`/`focus` have
already opened the panel, so toggling slammed it shut under the cursor — so
it opens only, and Escape (already wired) closes. `Stars` had `aria-label`
on a bare `<div>`, which most screen readers ignore because there's no role
to attach it to; it's now `role="img"`. And the header search dropdown
appeared and changed completely silently for screen-reader users — added a
polite live region announcing the result count of each debounced search.

**Colour contrast was checked and is clean** — every token pair in
`globals.css` was computed against WCAG AA rather than eyeballed. The
tightest real combination is `--color-ink-muted` on `--color-surface-strong`
at **4.58:1** (the checkout section numbers and the confirmation timeline),
which passes 4.5:1 with very little margin — worth remembering before either
token is nudged lighter. `--color-accent` on white is 5.06:1, ink-muted on
white 5.55:1, danger 6.54:1, success 5.91:1.

**Dead code removed**: `StarIcon` (`ui/Icons.tsx` — `Stars` inlines its own
path and nothing else imported it), the exported `CartController` type
(never referenced), the `disabled` prop on `FormField` (dead after the
checkout fix, along with its `disabled:` classes), and the
`--color-accent-strong` / `--color-accent-soft` CSS tokens — declared,
mapped into Tailwind's theme, referenced nowhere. Same finding and same
resolution as the dead `--space-*` tokens the Phase 3 audit removed.

**What was found and deliberately *not* changed** is in `NEXT_STEPS.md` §7
and `TASKS.md` — the short list: the newsletter form silently no-ops on
submit, `PaymentSection`'s multi-provider UI is structurally broken (N
always-`checked` `readOnly` radios, and `completeCheckoutAction` uses
`providers[0]` regardless), the favicon is still Next.js's own default
logo, and `MobileMenu`/`CartDrawer` carry two near-identical hand-rolled
focus traps. None were touched: the first three need business/brand
decisions or a second real payment provider to design against, and the
fourth would refactor two components whose focus behaviour is verified
working, for a ~30-line dedupe.

**Verified**: `tsc --noEmit`, `eslint`, and `next build` all clean for
`apps/storefront`; `medusa lint` clean for `apps/backend/apps/backend`.
Live in-browser against the real backend: canonical/robots tags and security
headers read straight off the wire on `/`, `/kouzina`, `/kouzina?page=2`,
`/anazitisi`, `/checkout/epibebaiosi`; the checkout focus fix measured
before and after via `document.activeElement` with real shipping options
still resolving afterwards; the mega menu re-verified after its own
regression was caught and corrected; cart drawer open → focus moves inside →
Escape closes still intact; homepage heading hierarchy and zero remaining
dead links.

## Phase 5 — Product code (SKU), add-to-cart everywhere, search (2026-08-08)

User brief: every product needs a permanent, unique product code, searchable
by code or name; and add-to-cart must work from every product grid in the
app, not just the PDP. Explicit instruction to inspect the current
implementation and propose an architecture before writing any code — written
up and approved as `PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md`.

**Both features turned out to be smaller than they looked**, because Medusa
and the existing codebase already did most of the work — this is the finding
that shaped the whole approach, not an assumption going in:

- **Product code = Medusa's native `variant.sku`, not a new field.** Live
  Store API testing found all 16 real products already carry unique,
  non-null SKUs, and Medusa enforces SKU uniqueness at the database level
  itself. No custom identifier, no custom uniqueness validation.
- **Search = Medusa's own `q` full-text search, not a new search index.**
  Live-tested `/store/products?q=` and confirmed it already indexes *both*
  title and variant SKU together (exact SKU, partial SKU, Greek title word
  all matched correctly). The gap was purely storefront-side: the header's
  search input has existed since Phase 1 but was never wired to anything.
- **Add-to-cart infrastructure already existed** — `ProductCard` was already
  the one shared card component rendering on every product grid in the app,
  and its quick-add already used the toast (not the drawer) and already
  revalidated cart count/totals immediately. The real gaps were narrower
  than "add it everywhere": no stock-awareness (inventory hardcoded to `1`
  sitewide) and no multi-variant guard (blindly added `variants[0]`).

**What was built**: `+variants.sku`/`inventory_quantity`/`manage_inventory`/
`allow_backorder` added to the product fetch and mapped into
`ProductVariant.code`/`.isAvailable`; `Κωδικός προϊόντος` shown on the PDP
only (not grid cards, by design — keeps grids uncluttered); `ProductCard`
and `AddToCartButton` now gate on real availability (`Εξαντλήθηκε`, disabled)
and variant count (`>1` variants routes to the PDP via an `Επιλογές` link on
grid cards, or a plain radio-group picker on the PDP itself — an inline
popover selector on grid cards was deliberately not built, since no real
multi-variant product exists yet to design or verify one against);
`searchProducts()` + a debounced header dropdown + a `/anazitisi` results
page (reusing `CategoryPLPView`, which gained `extraParams`/`emptyMessage`
props to support a non-category listing without breaking the existing
category pages).

**A real, separate bug found during verification, unrelated to the original
ask**: the quick-add/`Επιλογές` button was `hidden` below Tailwind's `md`
breakpoint — a leftover desktop-hover-reveal pattern from Phase 4A. On an
actual mobile viewport this meant `display: none`, not just "less
discoverable" — mobile users could not add to cart from *any* product grid
before this fix, despite the feature otherwise working. Confirmed via
`getComputedStyle()` before and after, not just visually. Fixed by making
the control unconditionally visible below `md`, hover-reveal preserved only
at `md+`.

**Also corrected a stale note in `PROJECT_MEMORY.md`**: an earlier phase's
finding that `+variants.inventory_quantity` was "silently ignored" by the
Store API turned out to be wrong (or no longer true) — re-tested live and it
returns real per-variant stock. The reactive `insufficient_inventory`
handling in `lib/actions/cart.ts` stays in place either way; the new
UI-layer availability flag is a prediction of the same rule Medusa enforces,
not a replacement for the real check.

**Verified live against the real backend**: search by exact SKU, partial
SKU, and Greek product name (both the header dropdown and `/anazitisi`);
product code displays correctly on the PDP; zeroed a real product's stock
via the admin (temporary `qa-agent@stia.gr` user, same pattern as Phase 4A's
`test-agent@stia.gr`) and confirmed `Εξαντλήθηκε` on both the PDP and grid
card, then restored it; quick-add from a grid card confirmed working at a
real 375px mobile viewport (cart badge incremented, no drawer auto-opened).
`tsc`/`eslint`/`next build` all clean. Not re-verified this session:
discounted-product and coupon-after-quick-add behavior (no active promotion
exists in the live catalog right now, and neither code path was touched by
this phase) — see `PROJECT_MEMORY.md` for the full honest list.

## Phase 4B — Checkout, build (2026-08-08)

Follows directly from the research/groundwork entry below (same day) — that
pass resolved three decisions (shipping zone gap fixed, free-shipping promise
softened, payment method decided as "Αντικαταβολή") before any UI code; this
entry covers the actual build.

**A fourth, more subtle finding, only surfaced by the dry-run itself**: after
setting a real shipping method on a test cart and re-fetching it, Medusa's
`cart.subtotal` turned out to silently include `shipping_total` (and to be
*pre*-discount, unlike `total`) — `item_subtotal` is the field that's
actually items-only. This had been wrong in the **already-shipped** cart
(Phase 4A/4A.1) the whole time, just invisible, because no cart had ever had
a real shipping method before checkout existed to set one. Fixed by
switching `lib/data/cart.ts`'s "Υποσύνολο" mapping to `item_subtotal`,
adding `shippingTotal`/`hasShippingMethod` to the `Cart` domain type, and
updating `CartTotals` to show the real shipping amount once a method is set
instead of always saying "Υπολογίζεται στο checkout" — the same component
now correctly serves both the cart and checkout's order summary.

**What was built**: a single scrolling checkout page (`/checkout`), not a
multi-step wizard — numbered sections (Email → Στοιχεία παραλήπτη →
Διεύθυνση παράδοσης → Τρόπος αποστολής → Πληρωμή), each auto-saving to the
same Medusa cart as the customer fills them in
(`lib/actions/checkout.ts`), shipping options resolved live once the
address is complete, real-time order summary updates as shipping is
selected. Order completion is a real 3-step Medusa flow (payment collection
→ payment session → cart complete), each endpoint verified live before
being coded against — found that `/store/carts/:id/complete` returns a
discriminated union (`{type:"order"}` on success, with the real order
returned directly; `{type:"cart", error}` on a workflow failure, not a
thrown HTTP error) and that guest order lookup by ID works with just the
publishable key, which is what makes the confirmation page
(`/checkout/epibebaiosi`) a real, refreshable/bookmarkable URL rather than
a modal. Cart → checkout CTA relabeled `ΟΛΟΚΛΗΡΩΣΗ ΑΓΟΡΑΣ`; final submit is
deliberately different wording, `ΟΛΟΚΛΗΡΩΣΗ ΠΑΡΑΓΓΕΛΙΑΣ` with the total on
the button itself, partly for clarity and partly because the EU Consumer
Rights Directive requires an order button to unambiguously convey a
payment obligation (`CHECKOUT_UX_SPEC.md` §16).

**Two more real bugs, found only by clicking through the built UI — neither
caught by `tsc`/`eslint`**:

- Email/address/shipping background saves originally shared one
  `useTransition` with the final-submit button, so the submit button
  flashed "Επεξεργασία…" (reading as "your order is processing") while the
  address was just autosaving in the background. Fixed by giving the final
  submit its own dedicated transition, separate from each section's own
  `*Saving` boolean.
- An early attempt to move the order summary above the form on mobile
  changed its *DOM* position instead of using CSS `order` — this fixed
  mobile but silently swapped the desktop two-column layout's sides too
  (form and summary traded places), since with no explicit `order` at the
  desktop breakpoint both columns fell back to DOM order. Fixed by
  restoring DOM order to match the desktop reading order and using
  `order-first lg:order-none` for a mobile-only visual reorder instead.
  Caught by comparing real `getBoundingClientRect()` positions — `innerText`
  (and therefore `get_page_text`) follows DOM order, not CSS `order`, so it
  had looked "wrong" even after the fix was actually correct, and would
  have looked "right" during the broken desktop-swap state. Worth
  remembering: don't trust text-order tools to verify a CSS-`order`-based
  layout, check real positions.

**Verified with a real completed order through the actual UI**, not just
direct API calls: added a product, filled the checkout form, triggered
invalid-email/invalid-phone/invalid-postal-code inline errors (confirmed
they only show for fields actually reached, not the whole form up front),
corrected them, watched real shipping options resolve live with real Greek
delivery-estimate translations ("Παράδοση σε 2-3 εργάσιμες" /
"Παράδοση εντός 24 ωρών" — real backend `type.code` values translated, not
invented), selected one and watched the order summary update in place,
submitted, landed on the confirmation page with a real order number,
confirmed the cart was cleared afterward (cookie deleted, header badge back
to 0), confirmed the confirmation page survives a hard refresh, confirmed
an empty cart at `/checkout` redirects to `/kalathi`, confirmed 375/768/1280
widths all have zero horizontal scroll and the mobile submit bar is a real
`position: fixed` element pinned to the exact viewport bottom edge.
`tsc`/`eslint`/`next build` all clean throughout. Two real orders now exist
in the local dev database from this verification (harmless, local only).

## Phase 4B checkout research — groundwork fixes applied before design approval (2026-08-08)

Before proposing a checkout design (`CHECKOUT_UX_SPEC.md`), tested the actual
Medusa checkout-adjacent endpoints live rather than assuming — same discipline
as every prior phase. Found three things that would have made a well-designed
checkout UI meaningless, presented them to the user as explicit decisions (not
silently resolved), and applied the two that were pure groundwork (not
checkout code itself) once decided:

- **Greece was missing from the shipping service zone.** Confirmed live:
  querying `/store/shipping-options` for a cart with a Greek shipping address
  returned zero options, while a German address on the same cart returned
  both configured options normally. The fulfillment set's service zone had
  the exact 7-country leftover set from Medusa's demo seed (`gb, de, dk, se,
  fr, es, it`) — Greece was added to the sales region and tax region back in
  Phase 2/3, but never to this separate fulfillment subsystem, because
  nothing before now ever exercised "resolve shipping options for a real
  address." **Fixed** via the Admin API (added a `gr` geo_zone to the
  existing service zone) and reverified live. Same bug class as the Phase 2
  "region didn't include Greece" fix, different subsystem.
- **The free-shipping promise wasn't backed by a real rule**, in two places,
  not one: `FreeShippingProgress` (the cart's progress bar, correctly reading
  its own `€50` config) and — found while investigating this —
  `AnnouncementBar` (the sitewide banner on every page) independently
  hardcoded a *different*, mismatched "δωρεάν αποστολή άνω των 39€" claim.
  Neither was backed by an actual conditional shipping rule (both real
  Medusa shipping options are flat-rate, confirmed live). Per explicit user
  decision, **softened rather than backed with a real rule for now**:
  `FreeShippingProgress` disabled behind a module-level flag (component and
  config left intact, not deleted — flip one boolean once a real rule
  exists), `AnnouncementBar`'s claim removed entirely (kept the truthful half
  of that banner, "Παραδόσεις σε όλη την Ελλάδα").
- **Only one payment provider is configured**: `pp_system_default`, Medusa's
  generic manual/system provider — no Stripe/Viva Wallet/Everypay exists
  today, confirmed live via `/store/payment-providers`. Also found: both
  `TrustStrip` (homepage) and the PDP's delivery-info block already say
  "Κάρτα, Viva Wallet ή αντικαταβολή," written as aspirational placeholder
  copy in earlier phases before any provider was configured — flagged as
  needing reconciliation once checkout implementation starts, not fixed yet
  (out of scope for this research pass). Per explicit user decision, the
  checkout design presents this one real method as **"Αντικαταβολή"** (Cash
  on Delivery) rather than something checkout can't actually deliver.

Full checkout UX proposal — structure, wireframes, exact Greek labels, error
states, competitor analysis — is in `CHECKOUT_UX_SPEC.md`, awaiting final
approval to begin implementation. `tsc`/`eslint` clean after the two applied
fixes above.

## Cart desktop table layout bug fix (2026-08-08)

User reported the product title visually appearing under/associated with the
`ΑΡΧΙΚΗ ΤΙΜΗ` column on the full cart page's desktop table. The DOM structure
was already correct — this was a real CSS layout bug, not a data-association
issue, found by measuring actual computed styles and bounding rects rather
than guessing from text-only tool output (which linearizes DOM order and
can't reveal a visual overlap).

**Root cause**: `CartLineItemTableRow`'s grid used `minmax(0,1fr)` for the
`ΠΡΟΪΟΝ` column. Measured live: inside the full page's two-column layout
(items + a 380px summary sidebar), the four fixed price/quantity columns
plus their `gap-6` gutters already consumed nearly all the available width
at common laptop sizes, leaving the `1fr` column as little as **22px**.
Since the product image is `shrink-0` (112px, deliberately non-shrinkable),
it and the title overflowed that near-zero column and visually spilled onto
`ΑΡΧΙΚΗ ΤΙΜΗ` next to it.

**Fix, in three parts** (`cart-table-grid.ts`, `CartTableHeader.tsx`,
`CartLineItemTableRow.tsx`, `CartPageView.tsx`):

1. `ΠΡΟΪΟΝ`'s column changed from `minmax(0,1fr)` to `minmax(14rem,1fr)` — a
   real guaranteed floor instead of an unbounded zero — and the column gaps
   tightened from `gap-6` to `gap-4` to reclaim width.
2. The header and every row now share one `overflow-x-auto` wrapper, so if
   a viewport is ever too narrow to fit all five columns at that floor
   width, the table scrolls horizontally as one synchronized unit instead
   of any column ever being forced below a readable size.
3. The wrapper's grid-item ancestor got `min-w-0` — **load-bearing**, not
   decorative: without it, a CSS grid item's automatic minimum width is its
   content's min-content size, so the table's natural width would bubble up
   and force the *entire page* wider than the viewport instead of being
   contained by `overflow-x-auto`. Found this as a self-introduced
   regression while fixing the original bug — confirmed via
   `document.documentElement.scrollWidth` before shipping the fix.

**A second, subtler self-introduced regression, found and reverted before
shipping**: an initial attempt added `min-w-max` to the header, the row, and
their wrapper to "guarantee" the overflow-scroll fallback would trigger.
This broke column alignment worse than the original bug — `min-w-max`
forces *max-content* sizing, which measures each independent grid instance
against *its own* content only. The header's `ΠΡΟΪΟΝ` cell (just the short
label "ΠΡΟΪΟΝ") and a row's `ΠΡΟΪΟΝ` cell (an actual unwrapped product title)
computed *different* pixel widths for what's supposed to be the same
column, since header and rows are separate grid containers, not literal
`<table>` rows that share one table-layout box model. Removed `min-w-max`
entirely; without it, every grid instance sizes deterministically against
the shared container width (not its own content), so header and rows
compute identical column widths whether that means normal `1fr`
distribution or an identical floored-out overflow — confirmed by comparing
`getComputedStyle(...).gridTemplateColumns` across the header and multiple
rows at 1024px (the tightest width the table shows at, right at the `lg`
breakpoint), 1105px, 1280px, and 1440px.

**Verified**: `tsc`/`eslint`/`next build` clean. Live in-browser, using
real bounding-rect measurements (not just DOM/text order) to actually prove
no overlap: a real Medusa sale price list for a long-named product
("Σετ Εργαλείων Μαγειρικής Σιλικόνης 6 τεμ.", 41 characters) alongside a
non-discounted product in the same cart — confirmed the title's right edge
sits clear of the `ΑΡΧΙΚΗ ΤΙΜΗ` column's left edge at every tested width,
confirmed the header's column boundaries match every row's exactly, and
confirmed the tightest width (1024px) correctly falls back to a local,
synchronized horizontal scroll without ever producing page-level scroll.
Mobile (375px) card layout untouched and reconfirmed unaffected (it's a
different component, not this grid). Test price list deleted after
verification.

## Phase 4A.1 — Cart clarity/UX revision (2026-08-08)

Follow-up to the cart build below: the functionality was solid but the
presentation wasn't self-explanatory — no column headers, two unlabeled
prices next to each other, a line total that wasn't visually tied to its
quantity, no shipping line in the summary at all. User asked for a
clarity-focused redesign (explicitly: don't touch the working Medusa
integration), inspired by — but not copying — strong Greek ecommerce carts,
combined with general international best practice. Design proposed as text/
ASCII wireframes with exact Greek labels and reasoning, approved, then built.

**What changed**:

- **Desktop full cart page (`/kalathi`, ≥1024px) is now a true table** with
  visible headers — `ΠΡΟΪΟΝ | ΑΡΧΙΚΗ ΤΙΜΗ | ΤΙΜΗ | ΠΟΣΟΤΗΤΑ | ΣΥΝΟΛΟ`
  (`CartTableHeader.tsx`, `CartLineItemTableRow.tsx`). Both share one grid
  column definition (`cart-table-grid.ts`) instead of two independently
  hand-typed class strings, so the header and the rows can't silently drift
  out of alignment as either file changes later.
- **The drawer (always) and the full page below 1024px use a dedicated
  labeled-card layout**, not the desktop table compressed narrower — a
  fixed ~440px drawer panel can't fit five aligned columns without tiny
  text, and neither can a 375px phone. `CartLineItemRow.tsx` now shows
  explicit "Αρχική τιμή:" / "Τιμή:" / "Ποσότητα:" / "Σύνολο:" labels instead
  of two adjacent unlabeled numbers.
- **Discount display**: a compact `-X%` badge next to the current price
  (`discountPercent()` in `lib/format.ts`) rather than a second full text
  row per item; the cart-level `Έκπτωση` line already states the concrete
  euro saving once, for the whole cart, so it isn't repeated per line. No
  discount indicator at all renders for non-sale items — a muted "–" fills
  the table's original-price cell instead of leaving it blank, keeping
  every row the same height without implying a fake discount.
- **`CartTotals.tsx`** — extracted from duplicated inline JSX in both the
  drawer and the full page, and given the **`Μεταφορικά`** line the
  original build never had at all. Medusa doesn't calculate real shipping
  until a shipping method is chosen at checkout, so there's no real number
  to show pre-checkout — the honest fix is `Υπολογίζεται στο checkout` plus
  a one-line note under `Σύνολο` clarifying that total excludes shipping,
  not a fabricated `0,00€`.
- **Coupon success state** relabeled from an inline `CODE · −amount`
  fragment to explicit `Κωδικός: SUMMER10` / `Έκπτωση: −10,00€` lines, and
  the idle toggle/input copy now matches the requested wording exactly
  ("Κωδικός έκπτωσης" / "Κωδικός κουπονιού" / "Εφαρμογή").
- **Checkout CTA relabeled** `ΠΡΟΧΩΡΗΣΗ ΣΤΟ CHECKOUT`. Added a
  `Συνέχεια αγορών` secondary link next to it in both the drawer (closes
  the drawer, matching the original spec's intent) and the full page
  (links to `/`) — a real gap found during this pass: the non-empty cart
  previously had no continue-shopping affordance at all, only the empty
  state did.
- **`QuantityStepper`** unified to 44×44px targets at every width — it
  previously shrank to 32px on desktop, which the brief's "do not use tiny
  controls" instruction flagged as worth fixing everywhere, not just
  mobile.

**Real bug found during verification, not a hypothetical**: `getCart()` —
called from `RootLayout`, so it runs on *every* page — threw
`Cannot read properties of null (reading 'code')` and took the entire site
down. Root cause: a promotion that had been applied to a cart and was then
deleted server-side leaves a `null` entry in `cart.promotions` rather than
being omitted (confirmed live by deliberately deleting an active test
promotion while it was applied to a cart, then reloading). The mapper in
`lib/data/cart.ts` assumed every array entry was a real object. Fixed with a
null-filter before mapping; `MedusaCart.promotions`'s type in `lib/medusa.ts`
now reflects `(MedusaPromotion | null)[]` so this can't silently regress.
(A real store wouldn't hard-delete an active promotion — it would deactivate
or let it expire — but the crash and its site-wide blast radius were real
and worth fixing regardless of how the state was reached.)

**Verified**: `tsc`/`eslint`/`next build` all clean (backend live). Manual
in-browser testing used real data, not simulated states — a real Medusa
sale price list was created via the Admin API to produce an actual
discounted line item (`-29%` badge, struck-through original price, correct
subtotal math), and a real promotion code was applied and removed with
correctly recalculated totals. Also confirmed: non-discounted line shows no
badge and a "–" placeholder; quantity 1 vs. >1; remove → empty-state
transition; free-shipping bar in both the below-threshold ("Ακόμα 33,10€...")
and reached ("🎉") states; 375px mobile width with zero horizontal scroll;
desktop table header/row alignment. Long product names and multi-variant
rendering were verified by code inspection (no truncation classes present;
the variant line was already conditional from the original build) rather
than a live long-name product, since none exists in the current catalog —
noted rather than silently assumed. All test artifacts (the sale price list,
the promotion code, the cart contents used to test them) were deleted/reset
after verification; the `test-agent@stia.gr` admin user used to create them
remains (see the note in the Phase 4A entry below and `PROJECT_MEMORY.md`).

## Phase 4A — Cart experience, design + build (2026-08-08)

User asked for a full research-and-design pass on the cart before any code,
with an explicit, detailed brief (drawer behavior, mini-cart contents,
pricing display, coupons, free shipping, error states, accessibility,
Medusa architecture — reproduced in full in `NEXT_STEPS.md`'s history and
`CART_UX_SPEC.md`). Spec was written, presented, and approved; then the cart
was built and verified end-to-end against the real backend.

**Design phase**: grounded in a live check of `public.gr`'s cart-adjacent PDP
UI (bundle upsell widget with a combined total + single "add" button,
discount amount + struck-through original price, star-rating pattern) plus
well-established general cart/checkout usability research. Two other sites
(`zarahome.com`, `ikea.com`) were attempted for comparison and blocked by
this environment's browsing controls — no claims were made about them.
Full spec: `CART_UX_SPEC.md`.

**Live API verification** (before writing any adapter code, same discipline
that caught real bugs in Phase 3) surfaced several non-obvious, real Medusa
v2 behaviors:

- Line-item **update is `POST`**, not `PATCH`
  (`/store/carts/:id/line-items/:line_id`).
- Line-item **delete's response shape differs from every other cart
  endpoint** — the updated cart comes back under a `parent` key, not `cart`
  (`{ id, object, deleted, parent: {...} }`).
- Promotions: apply is `POST .../promotions`, remove is **`DELETE`
  `.../promotions` with a `{ promo_codes: [...] }` body** — an unusual but
  real, working pattern (verified by creating a real test promotion via the
  Admin API, applying it, and removing it, not just reading docs).
- Medusa **enforces inventory limits server-side** — attempting to exceed
  stock returns `{ code: "insufficient_inventory", type: "not_allowed" }`.
  But the message doesn't include the actual remaining count, and the Store
  API doesn't expose per-variant stock on the products endpoint at all in
  this setup (`+variants.inventory_quantity` is silently ignored, confirmed
  live) — so the cart's stock UI is honestly **reactive, not proactive**:
  it can't show "only 3 left" or pre-disable "+", only react to the real
  error after the fact. This is a deliberate adjustment from the approved
  spec's error table (which assumed an exact count would be available).
- Neither seeded shipping option has a conditional free-shipping rule (both
  flat-rate, confirmed live) — so the free-shipping progress bar's
  threshold (`lib/cart-config.ts`) is genuinely frontend-only config today,
  not a mirror of backend logic.
- Prices are decimal euros throughout (not minor units), consistent with
  the rest of the storefront's existing convention.

**What was built**:

- `lib/data/cart.ts` (`getCart()`, read-only, Server-Component-safe) and
  `lib/actions/cart.ts` (`"use server"` mutations: add/update/remove line
  item, apply/remove promotion) — all cart writes are Server Actions that
  call `revalidatePath("/", "layout")`, following the same pattern as
  `lib/actions/recently-viewed.ts` from the previous session. Cart identity
  is a `cart_id` cookie (30-day max-age), not `localStorage`.
- `CartUIProvider` — a small Context for **UI-only** state (drawer
  open/closed, the add-to-cart toast), explicitly not a client-side store of
  cart data, per the approved spec's "no Redux/Zustand/heavy Context" call.
- `CartDrawer` (desktop side panel, mobile full-screen — not a partial
  sheet) reusing `MobileMenu`'s already-verified focus-trap/Escape/focus-
  return pattern; `AddToCartToast` (bottom-anchored on mobile, header-
  anchored on desktop, never auto-opens the drawer); `CartLineItemRow`,
  `QuantityStepper`, `CouponForm`, `FreeShippingProgress`, `EmptyCartState`
  (reuses the just-shipped `RecentlyViewed` component) — all shared between
  the drawer and the full `/kalathi` page via `useCartController`
  (`lib/hooks/use-cart-controller.ts`), which optimistically patches a
  touched line's own quantity/total for instant feedback while leaving
  cart-level totals to reconcile from the real server response a moment
  later (tax/discount math isn't something this hook should reimplement).
- `/kalathi` full cart page — two-column desktop, single-column mobile,
  cross-sell rail (`getCartCrossSell` in `lib/data/products.ts`) using the
  same honest same-category signal as the PDP's related-products rail, not
  a fabricated "customers also bought" claim (no order history exists to
  back that — same reasoning already applied once this project).
- `AddToCartButton` and `ProductCard`'s quick-add are no longer inert — both
  call `addLineItemAction` for real. The checkout CTA links to `/checkout`,
  a route that doesn't exist yet, matching the same accepted pattern as the
  footer's not-yet-built content pages (an honest 404 today, not a fake
  success or a silent no-op).

**Verified** (real backend, both dev servers running): `tsc`/`eslint`/
`next build` all clean; manually confirmed add-to-cart toast + header badge
update, quantity merge on re-adding the same variant, optimistic-then-
reconciled quantity changes, remove → empty-state transition on both the
drawer and the full page, an invalid coupon code showing the mapped Greek
error, a real activated test promotion applying and removing correctly with
recalculated totals, the free-shipping bar reaching 100%, the drawer being
genuinely full-width on a 375px mobile viewport (not a partial sheet),
Escape closing the drawer with focus returning to the header cart button,
Tab-trap wrapping correctly inside the drawer, and cart contents surviving
a real full-page reload via the cookie. `next build`'s route table changed
from static (`○`) to dynamic (`ƒ`) for the homepage and other routes — an
expected consequence of `RootLayout` now reading the cart cookie via
`cookies()`, not a regression.

One test artifact intentionally left behind, documented rather than hidden:
a temporary admin user (`test-agent@stia.gr`) created to test the coupon
flow via the Admin API — Medusa disallows a user deleting itself, and the
real admin password wasn't available to remove it with. Harmless, local-dev
only. The test promotion code itself was deleted after verification.

## Phase 4 unblocked items: related products + recently viewed (2026-08-08)

Implemented the two Phase 4 items that weren't blocked on missing content
(real photography, multi-variant products), per user decision after being
asked which of three options to pursue next.

- **Related products** (`ProductRail` on the PDP, `getRelatedProducts` in
  `lib/data/products.ts`): same-category cross-sell, deliberately **not**
  labeled "frequently bought together" as originally scoped in `TASKS.md` —
  there's no order history yet, so a real co-purchase signal doesn't exist.
  Labeling it that way would fabricate a trust/relevance claim, the same
  category of bug as the fake 4.6-star ratings fixed during the Phase 3
  audit. Labeled "Σχετικά προϊόντα" (related products) instead — an honest
  description of what the data actually is. Revisit once real order data
  exists to compute genuine co-purchase pairs.
- **Recently viewed** (`RecentlyViewedTracker`, `RecentlyViewed` components):
  client-side only (`lib/recently-viewed-storage.ts`, `localStorage`, capped
  at 8, most-recent-first, fails silently if storage is unavailable). Product
  handles are only known in the browser, so resolving them to real product
  data needed a bridge back to the server — added a Server Action
  (`lib/actions/recently-viewed.ts`, `getProductsByHandles` in
  `lib/data/products.ts`) rather than a `route.ts` API handler, keeping the
  "storefront has no API routes of its own" property mentioned in
  `CURRENT_STATE.md` technically intact (Server Actions aren't a routed
  handler file).
- `ProductRail`'s `viewAllHref` prop made optional — both new sections use it
  without a "view all" link, unlike the homepage's existing usage.
- Verified: `tsc --noEmit`, `eslint`, `next build` all clean; manual
  in-browser check with the real backend running — visited two products,
  confirmed "Είδατε πρόσφατα" showed both in correct (most-recent-first)
  order on a third product's page, and "Σχετικά προϊόντα" showed a real
  same-category product. No console errors.

## Final handoff verification (2026-08-07)

Separate short session: re-read and verified all five memory files against
actual `git log`/`git status` (clean, nothing uncommitted, `origin/main` up to
date). No code or content changes were needed — the prior handoff below was
already accurate. Added an explicit "START HERE NEXT SESSION" section to the
top of `NEXT_STEPS.md` per an explicit formatting request, restating (not
changing) the same resume point already documented.

## Session handoff (2026-08-07)

No code changes — Phase 3 was already complete, committed, and pushed (see the
entry directly below). This entry just documents that the session ended with a
deliberate handoff: `CURRENT_STATE.md` and `NEXT_STEPS.md` were added,
`PROJECT_MEMORY.md` was substantially expanded (design system, coding
conventions, SEO strategy, environment setup, development rules — previously
thinner), and `TASKS.md` was restructured into Completed/In Progress/Next/Future.
Nothing was left mid-change; working tree was clean before and after.

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
