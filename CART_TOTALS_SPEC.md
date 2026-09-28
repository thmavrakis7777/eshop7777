# Instant cart totals (Speed audit SPD-09)

Status: **built 2026-09-28, D1 and D2 approved by the owner, tested locally, not yet on production** · §9 has what implementation found · builds on `CART_STATE_SPEC.md` (SPD-08)

## 1. Problem (measured on production)

After a quantity change or a removal, the line itself updates at once, but
the numbers under it wait for the server:

| Drawer, quantity + | 19 Σεπ | After SPD-01 (24 Σεπ, desktop) |
|---|---|---|
| Line quantity and line total | instant | instant |
| Subtotal, discount, total, ΦΠΑ, free-shipping bar, header total | 1.14–1.35 s | 0.41–0.42 s |

Mobile on 4G was not re-measured after SPD-01. Expect more than desktop's
0.4 s, since the whole wait is one round trip.

For that time the screen disagrees with itself: the line says 2 × 24,50 € =
49,00 €, and the subtotal under it still says 24,50 €.

Why only the line moves today (`lib/hooks/use-cart-controller.ts`): the
optimistic patch "has no business reimplementing" discount and shipping
logic. That was the right call while the logic lived only on the server.
`computeTotals` (`lib/db/cart.ts`) has since become a pure function with no
database access, and it is already the one implementation shared by the
cart and order placement.

## 2. What the browser has and lacks

`computeTotals` needs three inputs:

| Input | In the browser's `Cart` today? |
|---|---|
| Each line's unit price, quantity, oversized shipping cost | Yes (`unitPrice`, `quantity`, `shippingCostCents`) |
| The applied discount's rule: type, value, minimum subtotal | **No.** Only the code and, for percentages, the percent |
| The saved shipping method's rule: price, free-over threshold, pickup, Heraklion-only | **No.** Only the resulting `shippingTotal` |

Without the last two, the browser can get the subtotal right but not the
discount (a minimum-subtotal code switches off below its threshold), the
shipping (free over a threshold, oversized surcharge, pickup) or the total.
A subtotal that moves while the total doesn't would be worse than today.

## 3. Proposal: the same function, run in the browser, with the server's answer still final

1. **Move `computeTotals` out of the server-only file** into
   `lib/cart-totals.ts` (pure, no `server-only`), next to the
   `highestOversizedFeeCents` it already calls from `lib/shipping.ts`.
   `lib/db/cart.ts` and `lib/db/checkout.ts` import it from there. Still one
   implementation: the browser runs the same code that prices the order.
2. **`Cart` carries the inputs it was priced with:** a new
   `pricing: { discount, shipping }` holding exactly the two objects
   `toDomainCart` already builds for `computeTotals` (discount type, value
   and minimum; shipping price, threshold, pickup, Heraklion-only). About
   150 bytes per cart. Nothing new is revealed: it is the shopper's own
   applied code, and shipping prices and thresholds are already shown at
   checkout.
3. **`recomputeTotals(cart)`** rebuilds subtotal, discount, shipping, ΦΠΑ,
   total, line totals and item count from the lines + `pricing`. The
   optimistic quantity change and the optimistic removal both end with it.
   Everything that reads the shared cart then moves together: drawer,
   `/kalathi`, checkout summary, header total and count, free-shipping bar.
4. **The server's answer still wins.** Nothing about ordering changes:
   optimistic edits keep the snapshot's `fetchedAt`, so the action's returned
   `Cart` always replaces them (`lib/cart-snapshot.ts`), as today. When the
   two agree, nothing visibly changes when it lands; when they don't, the
   server's numbers replace the browser's within that same round trip.
5. **Typed quantities above stock don't move the totals.** Today a typed
   quantity above stock is shown on the line but never sent. It gets the
   stock notice, and checkout's pay button is already blocked by
   `hasOverstockedItem`. Totals will move only for edits that are actually
   sent to the server, so they never include a quantity that can't be
   bought. (Edge case: if one line shows such an unsent number while
   *another* line's edit is sent, the totals include it until that edit's
   answer arrives and restores both lines from the server, as today.)
6. **Recommended: the pay button waits for cart edits in flight** (§6, D2).
   With instant totals, the `/checkout` pay button would show the new total
   ~0.4 s before the database has it. `CartUIProvider` counts edits in
   flight (started and finished in `useCartController`, with the finish in a
   `finally`, so a failed request can never leave the button locked), and
   `CheckoutForm`'s `canSubmit` also requires that count to be 0. The button
   then only ever offers to charge a total the server has confirmed.

## 4. When the browser's number can differ from the server's

The browser uses the unit prices and rules from the cart's last server
snapshot. The server re-reads the discount, the shipping method and
per-product shipping costs live. They differ only if, in the moment between
the snapshot and the edit:

- the owner edits that discount, the shipping method, or a product's
  oversized shipping cost, or
- stock drops below the new quantity (the server refuses the change, as
  today, and its answer restores the old quantity and totals with the usual
  «Δεν υπάρχει αρκετό απόθεμα…» message).

In both cases the server's numbers replace the browser's when the answer
arrives (about 0.4 s on desktop). The shopper is only ever charged what the
server computes at order time, as today.

## 5. Not changing

- **Stock, prices and discount validity stay server-only.** The browser only
  predicts the arithmetic of an edit; `updateItemQuantity`'s stock check and
  `completeOrder`'s re-pricing are untouched.
- **A line's stepper is still disabled while its own change is pending.** A
  second + on the same line waits for the first answer (~0.4 s), as today.
  Letting clicks queue is a separate change.
- Add to Cart (declined as SPD-12), coupon apply/remove and checkout's
  shipping choice still wait for the server. A coupon has to be validated
  first, and the shipping options are a separate PERF-009 item.
- No visual change: the same components show the same fields, just sooner.

## 6. Decisions for the owner

**D1. Do it at all?** The gain is the same size as SPD-12, which you
declined: about 0.4 s on desktop, likely more on mobile. The difference from
SPD-12:

- nothing is shown that the server later refuses in normal use. Stock can't
  refuse a + because the stepper already stops at stock, and the number is
  the server's own formula;
- it removes an inconsistency the screen has today (line total and subtotal
  disagree during the wait), rather than adding a new optimistic claim.

The cost: 5 files plus tests (7 with D2), and the cart payload grows by
~150 bytes.
My recommendation: **do it**.

**D2. Pay button waits for edits in flight?** Recommended: **yes**. The
window is ~0.4 s and only follows a drawer edit on `/checkout`. It is also
the only place where an unconfirmed number would sit next to a "pay" action.

## 7. Verification plan

- Unit tests (`lib/cart-totals.test.ts`; the 18 existing `computeTotals`
  tests in `lib/db/cart.test.ts` move with the function, unchanged): `recomputeTotals` on an unedited server cart returns the
  server's own figures; after a quantity change it matches `computeTotals`
  on the same lines, including a discount crossing its minimum, a cart
  crossing the free-shipping threshold, an oversized item, pickup, and a
  Heraklion cart over its threshold; after removing the last line it
  returns zero totals.
- Local (dev server against the production database, test cart emptied
  afterwards): +/− and remove in the drawer and on `/kalathi` → subtotal,
  total, ΦΠΑ, free-shipping bar and header move in the same frame as the
  line, and nothing changes when the server's answer lands. Coupon with a
  minimum: − below the minimum drops the discount at once. Typed quantity
  above stock: line changes, totals don't. On `/checkout`: drawer +1 → pay
  button moves, and is disabled until the answer lands.
- Gate: tsc, ESLint, Vitest, `next build`.
- Production after the push: time from + to the new total in the drawer.

## 8. Files

`lib/cart-totals.ts` (new: `computeTotals` moved here + `recomputeTotals`),
`lib/db/cart.ts` (import, `pricing` on `Cart`), `lib/db/checkout.ts`
(import), `lib/types.ts` (`Cart.pricing`),
`lib/hooks/use-cart-controller.ts`, `components/cart/CartUIProvider.tsx` and
`components/checkout/CheckoutForm.tsx` (D2 only), plus tests.

## 9. What implementation found (2026-09-28)

Built as proposed, with no changes to the design. `computeTotals` moved
unchanged; its 18 tests moved with it (`lib/cart-totals.test.ts`) and 7 new
ones cover `recomputeTotals`, with expected figures worked out by hand.

Tested locally (dev server against the production database, test cart
emptied afterwards). Times are from the tap to the first frame, then to the
server's answer. The local server is slower than production, which makes the
gap easier to see:

| Where | Totals on screen | Server's answer | Changed when it landed |
|---|---|---|---|
| `/kalathi` + (1 → 2) | 47 ms | 1.6 s | nothing |
| `/kalathi` + (2 → 3), + (3 → 4, crosses 79 €), − (4 → 3) | 43–291 ms | 1.3–2.1 s | nothing |
| Drawer + (1 → 2) | 62 ms | 1.3 s | nothing |
| `/kalathi` remove (empties the cart) | 21 ms | 1.8 s | nothing |

In every case the subtotal, total, ΦΠΑ, free-shipping bar, header count and
header total moved together. At 98,00 € the bar switched to «Έχεις ΔΩΡΕΑΝ
μεταφορικά» immediately. A typed 500 (stock 100) showed 12.250,00 € on the
line and the stock notice, while the totals and the header stayed at the
server's 73,50 € / 3 items and checkout stayed blocked, as §3.5 intends.

- **D2 was not exercised in a browser.** The pay button is only enabled
  once email, address and shipping are saved, and doing that locally means
  entering checkout details on a server that writes to the production
  database. The logic is a counter in `CartUIProvider`, started and finished
  (in a `finally`) only by the two edits that predict totals; check it on
  the preview deployment: drawer +1 on a filled-in `/checkout`, and the pay
  button should grey out until the answer lands.
- Gate: tsc, ESLint, Vitest 114/114, `next build`.
