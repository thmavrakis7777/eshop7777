# Page caching: serve public pages from Vercel's CDN

**Status (2026-10-19):** fix 1 shipped (642cee0). Fix 2 built the same day
after the owner chose the static CSP and the 1-hour safety refresh (see
"Decisions" at the end); this file records the design as built.

Written 2026-10-19, after Vercel's email: the Hobby team `harris-7777` had
used 75% of its free 4 h/month of Fluid Active CPU. At 100% Vercel pauses
the project, which takes the shop offline until the allowance resets.

## Why the CPU goes where it goes (measured live, 2026-10-19)

- Every storefront response is `x-vercel-cache: MISS` with
  `cache-control: private, no-store`: home, a category, a product page, and
  their RSC prefetch payloads alike. Nothing is ever served from the CDN, so
  every view, every bot hit and every prefetch renders React on a function.
- One desktop homepage visit (load + scroll) fired **56 background RSC
  prefetches** on top of the page itself, about 57 renders per visit.
- Data is not the problem. Almost every read is already behind
  `unstable_cache` (30–300 s, tagged), and Active CPU does not count time
  spent waiting on Postgres. Rendering is the cost.

## Fix 1, done in this session (prefetch on intent)

`components/ui/Link.tsx` replaces `next/link` in all 46 storefront files.
It prefetches on hover, focus or touch instead of on entering the viewport
(HoverPrefetchLink, already used by the mega menu). An explicit `prefetch`
prop still wins. Admin keeps `next/link`. The look doesn't change. Links
open a little less instantly on phones, because touch gives ~100 ms of head
start instead of a full prefetch.

Once fix 2 lands, prefetches become cheap CDN hits again, and viewport
prefetch can come back by deleting one `if` in `Link.tsx`.

## What stops caching today (fix 2)

| # | Blocker | Where | Why it forces per-request rendering |
|---|---|---|---|
| B1 | Per-request CSP nonce | `proxy.ts` sets it; read via `headers()` in `(storefront)/layout.tsx`, `proionta/[handle]/page.tsx`, `journal/[slug]/page.tsx`, `CategoryLandingView`, `CategoryPLPView`, `Breadcrumbs` | Next docs (guides/content-security-policy.md, "Static vs Dynamic Rendering with CSP"): a nonce must be fresh per response, so nonce pages cannot be static or ISR. |
| B2 | Cart and login read from cookies in the shared layout | `getCart()` and `getCustomerId()` in `(storefront)/layout.tsx` | Any `cookies()` read makes every page under the layout dynamic. |
| B3 | Category filters, sort and paging from `searchParams` | `[category]/**/page.tsx` → `CategoryRoute` | A route that reads `searchParams` renders per request, even with no query string. |

All three have to go for a page to be cached. Fixing only one changes nothing.

## Proposed design

### B1: a static CSP instead of a nonce (needs your decision)

Move the CSP from `proxy.ts` into `next.config.ts` `headers()` as a fixed
header, using Next's documented "Without Nonces" policy:
`script-src 'self' 'unsafe-inline'` plus the exact analytics hosts the
current policy already allows (GA4/GTM, Meta Pixel, Clarity, Sentry).
`connect-src`, `img-src`, `frame-ancestors` and the other headers stay as
they are.

- **What we lose:** today, a script without the nonce cannot run. With
  `'unsafe-inline'`, if a bug ever let someone inject HTML into a page, an
  injected inline script could run. The injection surface is small: React
  escapes text, `RichBody` turns admin text into React elements (no HTML
  string anywhere, by design), and the only `dangerouslySetInnerHTML` left
  in the storefront is JSON-LD through `safeJsonLd`. Most hosted shops
  (Shopify, WooCommerce) run without a nonce. RichBody's own comment names
  the nonce CSP as its first reason for avoiding a WYSIWYG editor; that
  reasoning should be updated in the same commit.
- **Alternative considered:** `experimental.sri` (hash-based). It is
  experimental, and it hashes built files only, while Next's own inline RSC
  scripts and the analytics init snippets are inline, so it would still need
  `'unsafe-inline'` or per-page hashes. I'd only try it after proving it in
  a production build.
- **Alternative:** keep the nonce and skip fix 2. Fix 1 alone might be
  enough; the October usage will show it.

`proxy.ts` stays for what it does besides the nonce (the admin cookie
check), with its matcher narrowed to `/admin` and the routes that really need it.

### B2: cart and login load in the browser

- The layout stops calling `getCart()` / `getCustomerId()`.
- A small route handler (`GET /api/session`, `no-store`) returns the cart
  and the signed-in flag. `CartUIProvider` and `WishlistProvider` call it
  once when the shop first loads. The layout survives client-side
  navigation, so this is **one request per visit**, not per page.
- Until it answers (~100–200 ms), the header cart badge shows nothing
  rather than a wrong number. The add-to-cart, cart page and checkout
  flows are unchanged: `/kalathi`, `/checkout/**` and `/logariasmos/**`
  stay dynamic, and they still read the cart on the server.

### B3: categories without a query string become cacheable

`proxy.ts` rewrites a category URL **with** a query string (`?sort=…`,
`?page=2`, filters) to an internal dynamic copy of the route. The plain URL
(`/kouzina`, `/kouzina/ergaleia-kouzinas`), which is what Google, menus and
most visitors open, becomes an ISR page. Visible URLs don't change.

### Freshness after an admin edit

- Cached pages get `revalidate = 3600` (1 h) as a safety net.
- Every admin save already calls `revalidatePath` / `updateTag` (178 call
  sites). Phase 4 audits each one so a price, stock, photo or text change
  shows on the cached page within seconds, as it does today.
- Stock: `completeOrder` revalidates the product's page, so "in stock"
  doesn't linger after the last piece sells. Checkout re-checks stock and
  price live either way, so a stale page can never undercharge or oversell.

## Phases (one commit each, each tested on a production build)

1. B2: `/api/session` and providers loading in the browser. The layout has no cookies.
2. B1: static CSP header, nonce removed from storefront pages. Only after your decision.
3. B3: the category query-string rewrite.
4. ISR on home, categories, products, journal and info pages, plus the revalidation audit.
5. Live check: `x-vercel-cache: HIT` on a second view, and Vercel usage the next day.

## Decisions (owner, 2026-10-19)

1. **CSP:** static policy, as proposed. Built as
   `src/lib/content-security-policy.ts`, set in `next.config.ts` headers.
2. **Freshness fallback:** 1 hour (`revalidate = 3600` on the storefront
   layout, category, product and journal pages).

## As built, differences from the proposal above

- **B3 rewrites live in `next.config.ts`, not `proxy.ts`.** Config
  rewrites run in Vercel's routing layer, so a cached page costs no
  function or middleware run at all. `src/lib/category-rewrites.ts` builds
  one `afterFiles` rule per depth and query key (`CATEGORY_QUERY_KEYS`);
  the app's own top-level folders are excluded, read from `src/app` at
  build time. Tracking parameters (utm_*, fbclid, gclid) don't match, so
  ad traffic gets the cached page.
- **`proxy.ts` now matches only `/admin` and `/logariasmos`.**
- **Whole-layout revalidation removed from login, sign-up, logout and
  checkout.** It would have emptied the whole page cache on each of them.
  The browser refreshes the session instead. A placed order refreshes only
  the sold products' pages (`revalidatePath('/proionta/…')`).
- **Dashboard saves still call `revalidatePath("/", "layout")`** (unchanged,
  about 15 product/content actions). With cached pages that empties the
  whole page cache on each save. That is deliberate: saves are a handful a
  day, and it keeps every edit visible within seconds. Narrowing them is
  possible later if usage shows it matters.
- **Still per request, by design:** /kalathi, /checkout, /logariasmos,
  /anazitisi, and the listings that read sort/page directly (/nea-afiksi,
  /prosfores, /best-sellers, /syllogi/*, /journal lists). Same rewrite trick
  can be applied to them later if usage shows they matter.
