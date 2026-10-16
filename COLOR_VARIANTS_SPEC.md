# Colour variants — spec (draft, 2026-10-16)

Owner's request: products **00013, 00017, 00023** (the three gas stoves in
«Καμινέτα Υγραερίου») come in several colours. The owner adds the colours in
the dashboard, each with its own stock. Shoppers choose the colour on the
product page **and directly on the product card**: in the «Νέες αφίξεις» row
and in the «Καμινέτα υγραερίου» subcategory.

## 1. What already exists (checked 2026-10-16)

- **Variants already work end to end.** `shop.product_variant` has its own
  SKU, price, stock, «Κατόπιν παραγγελίας» flag and stock history. Cart,
  checkout, stock checks, orders, order emails, "notify me when available"
  and the Meta feed all already work per variant. Order lines keep the
  variant title, so «Μπλε» would appear on the order and in the email.
- **The admin can already add variants:** «+ Νέα παραλλαγή» in the product
  editor (title, SKU, price, stock). Once a product has more than one, the
  panel turns into «Παραλλαγές (n)».
- **The live data today:** each of the three products has 1 variant
  («Default») and 1 photo:

  | SKU   | Product                                       | Price   | Stock |
  |-------|-----------------------------------------------|---------|-------|
  | 00013 | Καμινέτο υγραερίου μεταλλικό                  | 18,50 € | 3     |
  | 00017 | Καμινέτο υγραερίου πλαστικό                   | 11,50 € | 3     |
  | 00023 | Καμινέτο υγραερίου πλαστικό με αυτόματη ανάφλεξη | 15,50 € | 2   |

- **What's missing:**
  1. There's nowhere to store a colour (the hex value for a colour dot).
  2. The product page shows plain text buttons («Επίλεξε παραλλαγή»), not colours.
  3. **The product card can't add a product with more than one variant.** It
     shows an «Επιλογές» link to the product page instead. This is the main
     piece of new work.

## 2. Proposed design

### 2.1 Data (migration 0043)
- `shop.product_variant.swatch_hex text NULL`, checked to look like
  `#RRGGBB`. When it's set, the variant is a colour. When it's empty (every
  other product), nothing changes.
- *(Only if decision D1 = yes)* `shop.product_variant.image_id uuid NULL →
  shop.product_image(id) ON DELETE SET NULL`. This links each colour to one
  of the product's photos.
- This is a column on the variant, not the empty `product_option*` tables.
  Colour is the only option axis these products have, and the option tables
  would add three joins and a whole option editor with nothing real to use
  them for. That matches the 2026-08-16 decision in MIGRATION_PLAN.md §1.

### 2.2 Admin (product editor → Παραλλαγές)
- Each variant form gets a **Χρώμα** field: a colour picker, a small row of
  common colours (Μαύρο, Λευκό, Κόκκινο, Μπλε, Πράσινο, Κίτρινο, Γκρι,
  Ασημί) and a way to clear it.
- The variant's **title is the colour's name** that shoppers see
  («Κόκκινο»).
- *(D1)* A **Φωτογραφία** picker shows the product's own photos as
  thumbnails, and you tick the one that matches the colour.
- **Converting an existing product:** edit the «Default» variant, rename it
  to its colour, pick the colour and set its stock. Then «+ Νέα παραλλαγή»
  for each other colour. The existing variant keeps its SKU (00013), so
  nothing that already points at it (carts, past orders) breaks.
  New colours get a suffix SKU, for example `00013-2` and `00013-3`. The
  next-free-SKU suggestion only counts plain numbers, so the suffixes don't
  disturb it.
- The product list and the low-stock widget already work per variant.

### 2.3 Product page
- In place of the text buttons: **colour dots** with the colour name next to
  the label («Χρώμα: Κόκκινο»). A sold-out colour shows struck through, can
  still be chosen, and then offers «Ενημέρωσέ με» as it does today.
- The quantity limit, the stock message and the code shown follow the
  chosen colour.
- *(D1)* Choosing a colour switches the main photo to that colour's photo.

### 2.4 Product card (rails, category pages, «Νέες αφίξεις»)
- Under the price: a row of small colour dots (about 22px, with a large tap
  area). If there are too many for the card's width: the first ones plus
  «+N».
- **«Προσθήκη στο καλάθι» adds the selected colour** directly, with the same
  toast and the same cart as today.
- *(D1)* Tapping a dot switches the card photo.
- Stock status and the «Κωδικός» line follow the selected colour.
- If a variant has no colour set (for example some future "size" product),
  the card keeps today's «Επιλογές» link. Only colour variants get quick-add.

### 2.5 Unchanged
Cart and checkout, orders and emails, the Meta feed (it already sends one row
per variant with `item_group_id`), product JSON-LD (all colours share one
price, so it stays a single Offer), search, and every single-variant product.
The look of the card stays the same apart from the new row of dots.

## 3. Owner's decisions (2026-10-16)
- **D1: one photo per colour, made from the existing photo.** Claude recolours
  only the stove body. Every other pixel (wood, wall, chrome, lighting) stays
  identical, checked with a changed-pixel map. The real body colours still
  need to come from the owner, because the photos have to match stock that
  really exists.
- **D2: the first colour in stock starts selected** on the card. The product
  page does the same, for consistency.
- **D3: the dots show on every product card.**
- **D4: the dots go on the same line as «Κωδικός»** so a colour card is as tall
  as every other card in its row. Measured on a phone: the card is 160px,
  «Κωδικός: 00017» takes 90px, and the colour's code «00017-2» would take
  103px. So the card keeps the product's main code. Dots are 12px on phones
  (16px from 640px up) and show at most 4, then «+N». Verified on phone and
  desktop: same height and same button position as the neighbouring cards.
- **Photos approved by the owner:** 00013 red; 00017 and 00023 light green,
  orange and light blue (files in scratch/colour-photos/).

Also done while building it:
- **Cart lines show the colour** (a dot plus «Χρώμα: …») in the mini-cart,
  the cart page and the checkout summary, with that colour's photo.
- **Orders no longer save «Default»** as the variant name. It used to print
  under every line in the email, on the confirmation page and in the admin.
  The admin order page now shows «Χρώμα: …» so you know which one to pick
  off the shelf.
- **A colour picked on a card carries over to the product page** during the
  same visit (it's kept in browser memory, not in the URL).

## 4. Verification plan
- tsc, eslint and the unit tests.
- Storefront on localhost against a **new, inactive test product** with 3
  colours (one sold out). Remember that localhost writes to the live
  database. Check the product page, the card in a category grid, the card in
  a homepage rail, adding to the cart, and the cart line showing the colour.
  Then delete the test product.
- Migration 0043 applied to the live database only with the owner's OK.
- The admin editor needs the owner's logged-in session, as before.
- Converting 00013, 00017 and 00023 themselves is the owner's job in the
  dashboard. Only the owner knows the real colours and stock per colour.
