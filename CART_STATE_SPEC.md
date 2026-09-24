# Cart state without full-page refreshes (Speed audit SPD-08, + SPD-06)

Status: **implemented and tested locally, not yet committed** · 2026-09-24 · branch `perf/spd-08-cart-state` · §8 has what implementation found

## 1. Problem (measured on production, 24 Σεπ, after SPD-01)

Every cart action (`addLineItemAction`, `updateLineItemQuantityAction`,
`removeLineItemAction`, `applyPromoCodeAction`, `removePromoCodeAction`) ends
in `revalidatePath("/", "layout")` (`lib/actions/cart.ts`, `resultFrom`).
In Next 16, any revalidation inside a server action makes the response carry
a fresh render of the **whole current page**:

| Per Add to Cart (desktop) | Now |
|---|---|
| Action response | **221 KB** decoded / 44 KB on the wire |
| Follow-up requests | **25+** (revalidation wipes the router cache, so every visible link re-prefetches) |
| Toast → header count | 0.26–0.52 s → 0.40–0.84 s (header waits for the page re-render) |

The action **already returns the full `Cart`** (≈1–3 KB). The page refresh
exists only so the few places that show cart data pick up the change.

## 2. Who shows cart data today

| Where | Source today | Refreshed by |
|---|---|---|
| Header count + total | `getCart()` in `(storefront)/layout.tsx` → props | the full-page refresh |
| Cart drawer | its own `useCartController(null)` + `getCartAction()` on every open | its own action results |
| `/kalathi` (`CartPageView`) | page `getCart()` → `useCartController(initialCart)` | its own action results |
| `/checkout` (`CheckoutForm`) | page `getCart()` → `useState(initialCart)` | its own action results only |

Three separate copies of the cart that can disagree, plus the Header.

**Likely existing bug (to confirm while implementing):** the drawer opens on
`/checkout` too. Changing a quantity there refreshes the page, but
`CheckoutForm` keeps its first `useState(initialCart)` and ignores the new
prop, so the checkout summary can show **old totals**. The order itself is
priced on the server, so the charge is correct, but the shopper sees the wrong
total.

## 3. Proposal: one client-side cart, fed by the server

1. **One shared cart in `CartUIProvider`.** The layout passes its
   `getCart()` result in as the starting value. The provider exposes
   `cart` and `receiveCart(next)`.
2. **Newest server snapshot wins.** `Cart` gains `fetchedAt` (server
   `Date.now()` when it was read, set in one place in `lib/db/cart.ts`).
   `receiveCart` keeps whichever snapshot is newer. That settles in one rule:
   out-of-order responses from quick +/+ clicks, a page restored by the Back
   button with an old cart baked in, and the layout re-rendering after login
   or checkout. `null` (cart expired or order placed) is always accepted.
3. **Cart actions stop calling `revalidatePath`.** They return the `Cart` as
   now; every caller hands it to `receiveCart`: `AddToCartButton`,
   `useQuickAdd`, `useCartController`, and `CheckoutForm`'s line removal.
4. **Everyone reads the shared cart:**
   - Header count and total come from the provider (layout props removed).
   - `useCartController` edits the shared cart instead of its own copy, so
     the drawer, `/kalathi` and the header always agree. An optimistic
     removal moves the header count immediately; an optimistic quantity
     change doesn't, because the over-stock branch applies a quantity it
     never sends to the server.
   - **Drawer (SPD-06):** shows the shared cart the moment it opens. The
     existing `getCartAction()` stays, as a background refresh, to catch
     changes made in another tab or device.
   - **`/kalathi`:** renders from the shared cart and takes its server
     `initialCart` through `receiveCart` (so a fresh page wins and a stale
     Back-button page loses), plus one background refresh on mount.
   - **`/checkout`:** `CheckoutForm`'s `cart` comes from the shared cart
     (its own checkout actions feed `receiveCart`). This fixes the stale-summary
     bug in §2. Form fields (email, address, invoice details) stay local.
5. **What keeps `revalidatePath`:** login/register/logout (cart merge) and
   order placement (`lib/actions/customer.ts`, `lib/actions/checkout.ts:198`).
   They change more than the cart, and they're rare.

## 4. Not changing

- **Stock and prices stay server-only.** `addItem`'s locked transaction and
  `updateItemQuantity`'s checks are untouched. The client never computes
  what's allowed, only shows what the server returned.
- No optimistic Add to Cart (that is SPD-12, a separate decision).
- `/kalathi`'s cross-sell rail and its server-side empty state stay
  server-rendered. After an in-page change they refresh on the next visit, as
  they effectively do now.
- Checkout's own `revalidatePath("/checkout")` after email/address/shipping
  saves (`lib/actions/checkout.ts:62,144`) re-renders the checkout page on
  each save too. It's the same pattern, but part of PERF-009 and deliberately
  left for a follow-up.

## 5. Expected result (to be re-measured, not promised)

- Add to Cart response: 221 KB → ~1–3 KB; follow-up requests: 25+ → 0.
- Header count updates with the toast, not after it.
- Drawer contents: instant on open (was one server round trip).

## 6. Verification plan

- Unit tests: `receiveCart` ordering (newer wins, older ignored, `null`
  accepted); `fetchedAt` set on every `Cart` read.
- Local and preview: add from product page, product card and search; +/−
  and remove in the drawer, on `/kalathi` and on `/checkout`; coupon
  apply/remove; login with a guest cart (merge); place an order (the cart
  empties); Back/Forward across `/kalathi` and `/checkout` after changes.
- Confirm the `/checkout` stale-summary bug exists before the change and is
  gone after.
- Production after merge: Add to Cart response size, follow-up request count,
  toast and header timings.

## 7. Files

`lib/types.ts` (`Cart.fetchedAt`), `lib/db/cart.ts` (stamp),
`lib/actions/cart.ts` (drop revalidate), `components/cart/CartUIProvider.tsx`
(shared cart), `(storefront)/layout.tsx`, `components/layout/Header.tsx`,
`lib/hooks/use-cart-controller.ts`, `lib/hooks/use-quick-add.ts`,
`components/product/AddToCartButton.tsx`, `components/cart/CartDrawer.tsx`,
`components/cart/CartPageView.tsx`, `components/checkout/CheckoutForm.tsx`,
plus tests.

## 8. What implementation found (2026-09-24)

- **§2's checkout bug is real, and worse than a stale summary.** Confirmed on
  production before the change: with 1 item on `/checkout`, +1 in the drawer
  made the header and drawer show 2 items / 49,00 €, while the checkout
  summary *and the pay button* still read «ΟΛΟΚΛΗΡΩΣΗ ΠΑΡΑΓΓΕΛΙΑΣ ·
  24,50 €». After the change, the same test moves the pay button with the
  cart (73,50 € → 98,00 €).
- **The first Add to Cart per visitor still re-renders the page.** It creates
  the cart and sets the `cart_id` cookie, and Next re-renders the current
  page whenever a server action sets a cookie (documented behaviour in
  `guides/server-actions.md`). Measured locally: first add 104 KB, every
  later add 1.2 KB. Avoiding it would mean creating carts before anyone
  adds anything, so it's accepted: once per visitor per 30 days.
- **A second drawer bug went with the skeleton.** The drawer showed its
  loading skeleton whenever `cart` was `null`, and a visitor with no cart
  got `null` back, so the skeleton never ended. It now shows the empty
  state. (Found by reading the code, not reproduced on production.)
- **`displayedCart` differs from `newerCart` on ties.** `/kalathi` and
  `/checkout` show the shared copy when timestamps are equal, because only it
  carries optimistic edits. Covered by `lib/cart-snapshot.test.ts`.
- **Known limit on `/checkout`:** after a drawer edit, totals and the pay
  button update, but the list of shipping options (and their prices) is
  what the page loaded with, until the address is saved again. Before this
  change nothing updated at all.
- **Not tested:** login/register cart merge and placing an order. The first
  needs a real account password, and the local server writes to the
  production database, so an order would be real. Both keep their
  `revalidatePath` and go through the layout → `CartUIProvider` path;
  check them on the preview deployment.

Tested locally (dev server against the production database; test carts
emptied afterwards): add ×3 from the product page (response 104 KB, then
1.2 KB ×2; no follow-up requests); drawer shows lines within 60 ms of
opening; drawer +1 on `/checkout` updates the pay button; − on `/kalathi`
updates page and header together; Back to `/kalathi` after adding elsewhere
shows the newer cart immediately; invalid coupon shows «Ο κωδικός δεν είναι
έγκυρος.»; remove empties page, drawer and header; no console or server
errors. Gate: tsc, ESLint, Vitest 107/107, `next build`.
