# Cacheable content pages (Speed audit SPD-13, remaining part)

Status: **closed as "not now" by the owner (28 Σεπ 2026)**, following the recommendation in §5 · mega-menu part measured, see §7

SPD-13's first part, mega-menu links prefetching on hover only, shipped on
24 Σεπ (`db33546`). This spec covers the rest: serving pages like FAQ and
Terms from Vercel's CDN instead of rendering them on every visit.

## 1. The pages

`/faq`, `/oroi-xrisis`, `/aporrito`, `/cookies`, `/apostoles`, `/pliromes`,
`/epistrofes`, `/eggyisi`, `/sxetika`, `/epikoinonia`. Their content only
changes when edited in the dashboard, and every visitor sees the same page.
Today `next build` marks all of them `ƒ` (rendered per request), and
production answers them with `X-Vercel-Cache: MISS`.

## 2. Measured (production, 28 Σεπ 2026, curl from Greece, new connection each time)

| | Time to first byte |
|---|---|
| The 10 pages above, 4 runs each | **0.29–0.54 s** |
| A page already served from the CDN (`/robots.txt`, `/sitemap.xml`, `HIT`) | 0.22–0.27 s |
| Of which: connection setup alone | 0.15–0.17 s |

Caching would save roughly **0.07–0.27 s** per visit to these pages. On a
click inside the site the connection is already open, so the saving is the
server's share, about 0.1–0.25 s.

How often these pages are visited is **unknown**: Vercel Web Analytics isn't
enabled on the project (checked), and turning it on is a separate, possibly
paid, decision.

## 3. Why they render per request

All three causes are in the shared shop layout, `(storefront)/layout.tsx`,
so they apply to every storefront page, not just these:

1. **Cart.** `getCart()` reads the `cart_id` cookie. That cart seeds the
   header's count and total and the cart drawer (`CartUIProvider`, SPD-08).
2. **Login.** `getCustomerId()` reads the session cookie for the wishlist
   (`WishlistProvider isLoggedIn`).
3. **The CSP nonce.** `src/proxy.ts` creates a fresh nonce on every request.
   The layout gives it to the analytics snippets (GA4/GTM/Meta/Clarity) and
   the JSON-LD, and Next adds it to its own scripts. Next's own docs
   (`guides/content-security-policy.md`): a page using a nonce **must** be
   dynamically rendered, and Partial Prerendering is **incompatible** with a
   nonce-based CSP.

## 4. What caching them would take

All four of these are needed together:

- **Cart and login read in the browser on these pages.** The page would
  arrive without them, and the header's cart count and total and the
  wishlist state would fill in after an extra request. The header visibly
  changes after load, which is a **design change**, and each view makes a
  second request.
- **A script policy without a per-request nonce on these pages.** Either
  Next's Subresource Integrity, which is **experimental** ("may change or be
  removed") and covers Next's own script files only. The inline analytics
  snippets change whenever the dashboard's analytics settings change, so they
  would need hashes kept in step with those settings. Or `'unsafe-inline'`
  for scripts on these pages, which **weakens the XSS protection** the
  current policy was built for (see the comments in `src/proxy.ts`).
- **A separate layout for these pages**, so the rest of the shop keeps
  today's. That means two layouts to keep in step: header, footer,
  announcement bar, promo banner, consent banner.
- **Refreshing the cached copies on every related dashboard save.** That
  covers the page itself, and also the menu, footer, announcement bar, promo
  banner, branding and analytics settings, since all of them appear on these
  pages.

## 5. Recommendation: don't build it now

- The gain is ~0.1–0.25 s on informational pages. They're rarely the page
  that decides a sale, and there's no traffic data showing they matter.
- The cost is a visible header change, which you've ruled out for
  performance work, plus a weaker or experimental script policy and a
  second layout to maintain.
- Revisit if Next's hash-based CSP becomes stable (no nonce, no
  `'unsafe-inline'`), or if traffic data shows shoppers landing on these
  pages, for example from ads pointing at `/apostoles`.

So SPD-13 would close with its mega-menu part only.

## 6. Decision for the owner

- **Close SPD-13's remaining part as "not now"** (recommended), or build it
  anyway, accepting §4.
- **Still to verify either way:** the mega-menu fix (`db33546`) has never
  been measured, because the browser pane was hidden on 24 Σεπ, and a hidden
  page doesn't prefetch at all. It needs a *visible* desktop-width browser:
  open a mega menu and count the `_rsc` prefetch requests. Before the fix
  there were 54; expected now is about 0 on open, then one per link the
  pointer reaches.

## 7. Mega-menu fix, measured (production, 28 Σεπ 2026)

In-app browser, desktop viewport emulated at 1440 × 900, on `/sxetika`.

- **Control:** with the page visible, 23 prefetch requests fired for the
  links on screen at load. Prefetching was active, so a count here is
  meaningful.
- **Opening the ΚΟΥΖΙΝΑ mega menu with a real hover: 0 prefetch requests
  in 3 s**, with 49 links visible in the panel (54 requests before the
  fix). The page was still visible at the end of the window.
- **Not verified:** that reaching one link prefetches exactly that link.
  The pointer attempt closed the menu (the emulated page is drawn scaled
  down, so the jump from the trigger missed the panel). The keyboard-focus
  attempt ran while the page had gone hidden (app window in the background),
  and a hidden page doesn't prefetch, so its 0 is not a result.
