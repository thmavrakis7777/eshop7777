# Admin Guide

Everything you can manage yourself, without a developer.

**Where**: `http://localhost:3000/admin` in development (sign in at
`/admin/login`). In production it's `/admin` on your own domain — the admin
is part of the storefront app, not a separate system.

**Roles**: `Ιδιοκτήτης` (owner) sees everything. `Προσωπικό` (staff) can run
the shop day to day — products, orders, customers, content — but not
change store-wide money settings or manage other accounts. Owner-only
screens say so plainly instead of failing when you press save.

---

## Quick answers

| I want to… | Go to |
|---|---|
| Rename the shop | Header & Footer → Όνομα καταστήματος |
| Change the logo or favicon | Header & Footer |
| Change what's on the homepage | Αρχική σελίδα |
| Add a sale/promo section | Αρχική σελίδα → + Λωρίδα προϊόντων → Σε προσφορά |
| Change a hero image or its button | Αρχική σελίδα → Επεξεργασία on that hero |
| Add or edit a product | Προϊόντα |
| Fix a Google title/description | SEO (homepage, categories) or the product's own page |
| Change VAT or standard shipping | Ρυθμίσεις (owner only) |
| Change the top menu, or its order | Πλοήγηση |
| Make SALES red, or move it | Πλοήγηση → edit that item |
| Charge more to ship one heavy product | that product → Μεταφορικά |
| Show a phone number in the top bar | Header & Footer → phone orders |
| See what is currently on sale | Κατηγορίες → ΠΡΟΣΦΟΡΕΣ |

---

## Αρχική σελίδα — the homepage builder

This is the big one. The homepage is a **list of sections in the order you
put them**, top to bottom. Nothing about it is fixed in code.

Every section has the same controls:

- **↑ ↓** — move it up or down the page
- **Απόκρυψη / Εμφάνιση** — hide without deleting (drafts stay in this list,
  greyed, so nothing gets lost)
- **Επεξεργασία** — edit its content
- **Αντιγραφή** — duplicate it (the copy is created hidden, so you can edit
  before it goes live)
- **Διαγραφή** — remove it

### The section types

**Hero / Μεγάλο banner** — the big banner. Desktop image, a separate mobile
image if you want a different crop, alt text, eyebrow/title/text, and a
button you can switch off entirely. Two or more heroes **next to each
other** in the list automatically become a swipeable carousel; put another
section between them and they show separately.

**Προωθητικό banner** — a smaller two-column image + text block.

**Πλέγμα κατηγοριών** — category tiles. You pick which categories and in
what order; this is **independent of the shop menu**, so the homepage can
lead with Μπάνιο even if the menu starts with Κουζίνα. Leave the list empty
to show all main categories in menu order.

**Λωρίδα προϊόντων** — a horizontal strip of products. Choose where they
come from:

| Source | What it shows |
|---|---|
| Νεότερα προϊόντα | most recently added |
| Προτεινόμενα | a curated slice of the catalogue |
| Σε προσφορά | **only products that actually have a discount** |
| Από κατηγορία | everything in a category you pick |
| Από συλλογή | everything in a collection you pick |
| Χειροκίνητη επιλογή | exactly the products you choose, in your order |

For manual selection, search by product name, click to add, and use the
arrows to arrange them. This is how you build something like "Καλοκαιρινές
Επιλογές" with precisely the products you want.

**Κείμενο & εικόνα** — a free-form block: image (desktop + mobile), title,
text, optional button. Use it for anything the other types don't cover.

**Εγγυήσεις καταστήματος** — the guarantee tiles. Each has an icon (chosen
from a fixed set), a title, a description, an order and a show/hide toggle.
The icon list is closed on purpose: these render as inline graphics, so
free-form input would be a security hole.

Write only what the shop actually does. These are promises about delivery,
returns and payment, and nothing checks them against what checkout can
really offer — an earlier version of this strip advertised two payment
methods the shop did not have.

**Newsletter** — title, text, button label and an optional background image
are all yours. **The form does not collect anything yet**: there is no
mailing-list integration in this project, so a shopper who submits it gets
nothing. Wiring that up is a separate job.

### Button destinations

Anywhere there's a button, the destination field has a **Γρήγορη επιλογή**
dropdown listing your real categories, collections and key pages. Pick one
and it fills in the address. You can also type any address yourself,
including an external `https://…` link. Nothing is hardcoded to a
particular category.

### If a section shows nothing

That's intentional. A section with no usable content renders nothing rather
than leaving an empty heading on the page — for example a product rail
whose category you later deleted, or a category grid pointing at categories
that no longer exist.

---

## Header & Footer — your brand

Everything here changes the whole storefront at once.

| Field | Where it shows |
|---|---|
| Όνομα καταστήματος | header, footer, copyright line, browser tab title, Google results, structured data, **and outgoing emails** |
| Λογότυπο | replaces the text name in the header/footer. Leave empty to show the name as text |
| Favicon | the small icon on the browser tab |
| Εικόνα κοινοποίησης (OG) | the preview image when someone shares a link on social/messaging |
| Προεπιλεγμένος τίτλος SEO | the homepage's title, and the "… \| Name" suffix on every other page |
| Προεπιλεγμένη περιγραφή SEO | used wherever a page has no description of its own |
| Μπάρα ανακοίνωσης | the strip above the header. Empty = no strip at all |
| Μήνυμα στο καλάθι | shown in the cart, not at checkout |
| Στοιχεία επικοινωνίας, social | footer, and your Organization structured data |
| Συντελεστής ΦΠΑ, όριο δωρεάν μεταφορικών | **owner only** |

Images accept either a full `https://…` address or an uploaded file path.
Until Supabase Storage is configured (see Πολυμέσα), use full addresses.

**Renaming the shop**: change Όνομα καταστήματος and save. That's the whole
job — there's nothing else to update.

---

## Προϊόντα, Κατηγορίες, Συλλογές, Απόθεμα

**Προϊόντα** — create and edit products: title, URL slug, description,
category, collections, images, characteristics (material, weight,
dimensions, origin), a badge, warranty text, and per-product SEO. Prices
and stock live on the product's variants. Bulk-select rows to activate,
deactivate, recategorise, adjust prices, set stock or archive in one go.

**Κατηγορίες** — your product categories and their subcategories. Order here
controls where they appear on category pages and in pickers; the **top menu
is separate** and is managed under Πλοήγηση, so adding a category no longer
puts it in the menu automatically. A category with subcategories or products
cannot be deleted until you move them, so nothing is orphaned silently.

**Three levels.** You can nest categories three deep — main → subcategory →
sub-subcategory (e.g. ΚΟΥΖΙΝΑ → Μαγειρικά Σκεύη → Τηγάνια). Set the level with
the **Γονική κατηγορία** dropdown; it only offers parents that would still fit
inside three levels, so you cannot accidentally create a category the shop
can't show. Moving a category takes its subcategories with it. Three is the
limit because the shop's web addresses have three parts — a fourth level would
be creatable here and broken in the shop.

**Each category can have:**

| Field | What it does |
| --- | --- |
| Όνομα | The name shoppers see |
| Slug (URL) | The web address. Filled in automatically from the name — **changing it on a live category breaks any existing link to it**, so only change it if you mean to |
| Γονική κατηγορία | Which category it sits under (blank = main category) |
| Σειρά | Position among its siblings |
| Περιγραφή | Text shown below the product grid |
| Εικόνα | Picture used on the parent's "shop by category" cards. Leave blank and it falls back to the category's first letter |
| Τύπος σελίδας | **Προϊόντα** (normal product listing) or **Landing** — see below |
| Συχνές ερωτήσεις | Up to five question/answer pairs, shown at the bottom of the page. Leave blank to show none |
| Ενεργή | Uncheck to hide it — this hides its whole branch, subcategories included |

**Landing pages.** Setting Τύπος σελίδας to *Landing* turns a category into a
service page instead of a product list — used for
Αντιγραφή Κλειδιών Σπιτιού, a service performed in the shop rather than
something with stock. It shows your description, image, FAQ and shop contact
details instead of an empty product grid, and it appears to shoppers as
«Υπηρεσία καταστήματος» rather than "0 προϊόντα". Any FAQ you add here is also
sent to Google as structured data, so it can appear directly in search results.

This screen also shows ΠΡΟΣΦΟΡΕΣ and ΝΕΕΣ ΑΦΙΞΕΙΣ — see «Αυτόματες
κατηγορίες» below.

**Συλλογές** — cross-category groupings ("Δώρα για το σπίτι"). Each gets
its own page at `/syllogi/<slug>`. Add products to a collection from the
**product's** page, not here. Note that collections don't appear in the
shop menu on their own — link to them from a homepage section.

**Απόθεμα** — stock levels across all variants, with low-stock and
out-of-stock filters. Every change is recorded with who made it.

---

## Πλοήγηση — the top menu

**Πλοήγηση** is the bar of links across the top of the shop. It is a list you
compose: add, edit, hide, reorder and delete, and the list order is the order
shoppers see, left to right. The mobile menu shows exactly the same items in
exactly the same order.

Each item points at one of:

| Destination | Goes to |
|---|---|
| Κατηγορία | that category — and opens a dropdown of its subcategories |
| Συλλογή | that collection's page |
| Προϊόν | a single product |
| Προσφορές | the sale page, which fills itself |
| Νέες αφίξεις | the new-arrivals page, which fills itself |
| Άλλη διεύθυνση | any page of yours, or an external link |

**Nothing is forced to a position.** SALES can be first, fifth or hidden.

Each item can have its own text and background colour — that is how you get a
red SALES chip. Leave them empty for normal styling. The editor previews the
result and warns you if the two colours are too close to read; it will not
stop you saving, and it only accepts colours, so you cannot break the layout.

**If you delete every item**, the menu falls back to showing your main
categories automatically. You never end up with an empty bar.

Creating a category does **not** add it to the menu. That is deliberate — you
decide what belongs up there. Add it here when you want it.

---

## Αυτόματες κατηγορίες — ΠΡΟΣΦΟΡΕΣ and ΝΕΕΣ ΑΦΙΞΕΙΣ

These two sit on the **Κατηγορίες** screen beside your real categories, but
they work differently: **you never add or remove products from them.**

**ΠΡΟΣΦΟΡΕΣ** contains every product whose sale price is below its regular
price. Put a product on sale and it appears; remove the sale price and it
disappears. If the two prices are equal, that is not a discount and it does
not count.

**ΝΕΕΣ ΑΦΙΞΕΙΣ** contains everything created in the last 30 days, newest
first. To keep something there for longer, tick **Σήμανση ως «Νέο»** on the
product. That can only keep a product in — it can never push out a genuinely
new one.

Click **Δες τα προϊόντα** on either card to see what is currently in it, in
the normal product list. Each card shows a live count.

They have no Edit or Delete button, and you cannot assign products to them by
hand. That is not an omission — any such control would contradict the prices
and dates that actually decide membership.

On a product's own page, the **Αυτόματες κατηγορίες** panel tells you whether
that product is in each one and why, e.g. "50,00 € → 39,90 € (−20%)". It is
information only.

---

## Μεταφορικά για βαριά και ογκώδη προϊόντα

Most products ship at your standard rate and need nothing here. For the ones
that genuinely cost more to send, open the product and use the **Μεταφορικά**
panel: pick Βαρύ, Ογκώδες or Ειδικό and enter a cost.

How a basket is charged:

- **Only normal products** → your standard shipping, once, and free above
  your free-shipping threshold.
- **Any special product** → each special product is charged its own cost,
  multiplied by quantity, and the normal products travel along for free.

So 2 heavy items at €8 plus a normal item costs **€16**, not €19.50.

Two things worth knowing: the free-shipping threshold does **not** cancel
these costs — a big order does not make a bathtub cheaper to send — and store
pickup skips all of it. Choosing a type without entering a cost leaves the
product on standard shipping, so the label alone never charges anyone.

---

## Παραγγελίες, Πελάτες, Εκπτώσεις

**Παραγγελίες** — every order with its status, contents, addresses, and
whether it needs a receipt or invoice. Opening one shows its full history.

**Πελάτες** — accounts, their orders and addresses. Deactivating an account
signs it out everywhere immediately.

**Εκπτώσεις** — discount codes: percentage or fixed amount, minimum cart
value, expiry, usage limits.

---

## Σελίδες, Πολυμέσα, SEO

**Σελίδες** — the eleven static pages (Σχετικά, Αποστολές, Επιστροφές, Όροι,
FAQ, Επικοινωνία, and the rest). Each is a draft until you publish it; an
unpublished page returns 404 rather than showing an empty shell. Text only,
no HTML.

**Πολυμέσα** — image library. **Upload is not active yet**: it needs two
Supabase Storage credentials in the app's environment, and the screen tells
you exactly which. Until then, image fields accept full `https://…`
addresses from anywhere.

**SEO** — homepage and per-category search-engine settings: title,
description, social preview, and whether a page should be indexed at all.
Product SEO lives on the product's own page, since it's easier to write
with the product in front of you. Leave anything empty and a sensible
default is used. Sitemap, robots.txt, canonical URLs and structured data
are generated automatically and need no attention.

---

## Ρυθμίσεις

- **Λογαριασμός** — your own name, email and password.
- **Αποστολές** *(owner)* — shipping methods, prices, free-shipping
  thresholds, and which count as store pickup.
- **Αναζήτηση** — synonyms, so a customer searching "σεντόνια" also finds
  "σεντόνι". Products can also be boosted or hidden from search on their own
  page.
- **Analytics** *(owner)* — Google Analytics 4, Tag Manager, Meta Pixel and
  Clarity IDs. Nothing loads until a visitor accepts cookies, and no script
  loads at all for a service you haven't filled in. Only plain IDs are
  accepted — anything else is rejected, because these values end up inside
  scripts running on your storefront.
- **Διαχειριστές** *(owner)* — admin accounts and roles. The last active
  owner can't be removed or demoted, so you can't lock yourself out.
  Deactivating an admin ends their sessions immediately.

---

## Things that still need a developer

Being straight about the current limits:

- **Uploading image files** — needs Supabase Storage credentials configured
  once. After that it's self-service.
- **The newsletter form actually collecting addresses** — the copy is yours,
  but submissions currently go nowhere.
- **SEO for the ΠΡΟΣΦΟΡΕΣ and ΝΕΕΣ ΑΦΙΞΕΙΣ pages.** They have proper titles,
  descriptions, canonical URLs and breadcrumbs, but those are not yet
  editable from the SEO screen the way category pages are.
- **Adding a new *type* of homepage section** beyond the seven above.
- **Payment methods** beyond cash on delivery — a card processor is a real
  integration.
- **Redirects for changed addresses.** There is no redirect system. If you
  change a category's slug, or move a category to a different parent, its old
  web address stops working immediately — anyone following an old link, and any
  search result still pointing there, gets the "page not found" page. Nothing
  is lost and the shop is fine, but the old address is simply gone. If you need
  to reorganise categories that already have traffic, ask for redirects first.
- **The two fixed sections on the key-copying landing page** («Τι Κλειδιά
  Αντιγράφουμε» and «Γιατί να Επιλέξετε…») are written into the code. The
  description, image and FAQ on that page *are* yours to edit; those two
  sections are not.
