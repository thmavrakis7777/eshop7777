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
| Change VAT or shipping cost | Ρυθμίσεις (owner only) |

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

**Εγγυήσεις καταστήματος** and **Newsletter** — the four guarantee tiles and
the signup band. You control **where they sit and whether they show**, but
not their wording. That's deliberate: the guarantees state real delivery,
returns and payment promises that have to match what checkout actually
does, and the newsletter form isn't wired to anything yet, so editable copy
would advertise something that doesn't work.

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

**Κατηγορίες** — the shop menu. Order here is the order customers see.
A category with subcategories or products can't be deleted until you move
them, so nothing is orphaned silently.

**Συλλογές** — cross-category groupings ("Δώρα για το σπίτι"). Each gets
its own page at `/syllogi/<slug>`. Add products to a collection from the
**product's** page, not here. Note that collections don't appear in the
shop menu on their own — link to them from a homepage section.

**Απόθεμα** — stock levels across all variants, with low-stock and
out-of-stock filters. Every change is recorded with who made it.

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
- **The wording of the guarantee tiles and the newsletter block**, and the
  newsletter form actually collecting addresses.
- **Adding a new *type* of homepage section** beyond the seven above.
- **The shop menu structure** — it follows your categories; there's no
  separate menu builder.
- **Payment methods** — cash on delivery is the only one configured. A card
  processor is a real integration.
