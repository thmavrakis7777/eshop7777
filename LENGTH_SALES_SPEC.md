# Sold by the metre — spec (draft, 2026-10-17)

Owner's request: product **00046 «Λάστιχο υγραερίου Ιταλίας»** is sold by the
metre. The shopper chooses 1 μ, 1,5 μ, 2 μ, 2,5 μ … up to 20 μ. The price is
3,00 € per metre and the total updates by itself (2,5 μ → 7,50 €). Stock is
counted in metres.

## 1. What exists today (checked 2026-10-17)
- 00046 is **inactive**, priced 3,00 €, with stock 0 and in nobody's cart.
  Nothing on the live site is affected while this is built.
- **Every quantity in the shop is a whole number:** the cart, stock, order
  lines, stock history, «Κατόπιν παραγγελίας», and the totals check on
  orders. The money maths everywhere is `unit price × quantity` in whole
  cents.

## 2. Proposed design: count half-metres, show metres
Switching the database to decimal quantities would touch every money and
stock path in the shop (cart, checkout, totals, VAT, discounts, free-shipping
thresholds, order cancel/restock), which is a lot of risk for one product.
Instead:

- **Inside the system, a "length product" is counted in steps of 0,5 μ.**
  2,5 μ = 5 steps. All existing whole-number maths, stock checks and
  constraints keep working unchanged.
- **The price stays per metre on the product** (3,00 €). Search, sorting by
  price, filters, Google data and the dashboard list keep showing the true
  per-metre price.
- **The price of one step** (1,50 €) is worked out in exactly two places:
  when the item goes into the cart, and when checkout re-checks prices.
  2,5 μ = 5 × 1,50 € = 7,50 €, in whole cents with no rounding.
- **Everywhere a shopper or you see a quantity, it's shown in metres**:
  «2,5 μ», «3,00 € / μ».

### 2.1 Data (migration 0044)
- `shop.product.length_step_cm` (NULL = sold by the piece, as now; 50 = sold
  by length in 0,5 μ steps), `length_min_cm` (100) and `length_max_cm`
  (2000).
- `shop.order_item.length_step_cm`: a copy taken at order time, so past
  orders still read «2,5 μ» even if the product changes later.
- The price per metre must divide evenly into steps (3,00 € → 1,50 €). A
  price like 2,99 € can't be split into two equal half-metre prices, so the
  dashboard refuses it with a clear message.

### 2.2 Dashboard
- Product editor: a **«Πώληση με το μέτρο»** box with Βήμα (0,5 μ), Ελάχιστο
  (1 μ) and Μέγιστο (20 μ).
- The variant form then reads **«Τιμή ανά μέτρο»** and **«Απόθεμα (μέτρα)»**,
  and accepts 37,5 for example.
- The Αποθήκη screen, the low-stock widget and stock history show metres.
  The −/+ buttons move by 0,5 μ.
- Changing the step size later rescales the stock and removes the product
  from open carts, so nobody pays an old step price for a different length.

### 2.3 Shop
- **Product page:** the price reads «3,00 € / μέτρο». Instead of
  «Ποσότητα» there's **«Μήκος»** with − / + buttons in 0,5 μ steps, from
  1 μ up to the smaller of 20 μ and the stock. The total updates live
  («Σύνολο: 7,50 €»). If someone asks for more than the stock, it shows the
  usual stock-inquiry notice.
- **Cart, mini-cart and checkout:** «2,5 μ × 3,00 €/μ = 7,50 €». The
  stepper moves by 0,5 μ. The header cart badge counts the hose as 1 item,
  not 5.
- **Order confirmation page, email and admin order:** «Μήκος: 2,5 μ».
- **Google data (JSON-LD):** the price is 3,00 € per metre (unit code MTR).

### 2.4 Unchanged
Every product sold by the piece. Money totals, VAT, discounts, shipping and
free-shipping thresholds all work as before. A 7,50 € hose line counts
towards «δωρεάν μεταφορικά» like any 7,50 € item.

## 3. Owner's decisions (2026-10-17)
- **D1:** 20 μ is the **most per customer** (per order line). Stock is
  separate and entered in metres.
- **D2:** the card button reads **«Επίλεξε μήκος»** and opens the product
  page. The search box and the homepage showcase do the same, so a length
  product is never added by a single tap.
- **D3:** **no note** about cutting, for now.

Built on top of the spec:
- **"+" at 20 μ just stops.** The «ρώτα μας για απόθεμα» notice only
  appears when the ceiling is the stock, not the owner's limit.
- The **«Πώληση με το μέτρο»** panel has its own save button. Before saving,
  it warns that changing the unit rescales or zeroes the stock and removes
  the product from open carts.
- **Order cancel/restock** works unchanged, because it's counted in steps on
  both sides.

## 4. Verification plan
tsc, eslint and the unit tests, including new ones for the step maths. Then
the full flow on localhost (product page, cart, checkout totals) with a
temporary test product that is deleted afterwards, as with the colours.
00046 stays inactive until the owner switches it on. Migration 0044 is
applied to the live database only with the owner's OK. No test order is
placed without asking.
