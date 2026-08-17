# Admin Guide

> **⚠ Superseded (2026-08-17).** This describes the old Medusa Admin
> (`localhost:9000/app`), which no longer exists. The real admin is now a
> custom dashboard at `/admin` on the storefront itself — see
> `MIGRATION_PLAN.md` for the architecture. The `/admin/*` routes have
> broadly equivalent capability (product/category/SEO/settings management)
> under a different UI; a rewritten version of this guide for the new
> dashboard doesn't exist yet — a real, known gap, not addressed in this
> pass.

A running reference for everything you can manage yourself from the Medusa
Admin (`http://localhost:9000/app` in dev), without touching code. This file
grows one section per phase of the "Admin-first platform" initiative — see
`TASKS.md` for the full roadmap and `PROJECT_MEMORY.md` for the technical
architecture behind each capability.

**Sign in with your own `admin@stia.gr` account.** Nothing in this guide
needs developer access.

---

## Product SEO

**Where**: open any product (`Products` → pick one), scroll the right-hand
sidebar past the existing "Organize" panel — a new **SEO** card sits there.

**What it controls**: search-engine and social-sharing presentation for that
one product's page, independent of the product's real title/description
(which stay focused on customers, not search engines).

| Field | What it does | Leave empty to… |
|---|---|---|
| SEO Title | `<title>` tag and Google's blue result link. **Used exactly as typed** — the site's usual " \| STIA" suffix is skipped for this one field, since a custom SEO Title is meant to be the final, complete title you want, not something the site appends to further. | fall back to the product title (which *does* get the " \| STIA" suffix, as normal) |
| Meta Description | the snippet under the title in Google results | fall back to the product's own description, then the title |
| Canonical URL | tells Google which URL is the "real" one for this content | fall back to the product's normal `/proionta/{handle}` URL — leave empty unless you have a specific reason to point elsewhere |
| OG Title / OG Description | what shows when the product is shared on Facebook, WhatsApp, etc. | fall back to the SEO Title / Meta Description above |
| Social Image URL | the image shown in that same share preview | falls back to nothing shown — a dedicated image tends to convert better on social than the plain product photo, since it can include a price/badge overlay |
| Λέξεις-κλειδιά (keywords) | stored for your own reference | has no measurable effect on Google ranking today — modern search engines ignore the meta-keywords tag. Kept because it was requested, not because it helps SEO. |
| Robots | Index (default) or Noindex | Index — only switch a product to Noindex if you genuinely don't want it findable via Google (e.g. a test/sample listing), since Noindex removes it from search results entirely |
| Structured Data Override | *(not yet in the widget's form — the field exists and the storefront already merges it into the page's Product JSON-LD if set directly via the API; a UI for it is a small follow-up)* a raw JSON-LD merge for the rare product needing a schema.org field the automatic markup doesn't produce | leave empty — the automatic Product/Offer markup already covers price, availability, SKU, material, and weight for every real product |

**Best practices**:
- Keep SEO Title under ~60 characters — Google truncates longer ones in results.
- Keep Meta Description around 150–160 characters — same truncation risk.
- Don't stuff keywords into the title/description unnaturally; write for the
  customer first, Google rewards that more than keyword density today.
- Only fill in fields where the automatic default genuinely isn't good
  enough — an empty field is never a mistake, it's the intelligent default
  working as intended.

**Image recommendations for the Social Image**: 1200×630px (the standard
Open Graph size — Facebook/WhatsApp/LinkedIn all crop to roughly this
ratio), under ~1MB, real photography or a designed graphic rather than a
plain product cutout on white (which reads as low-effort in a social feed).

---

## Category SEO

**Where**: open any category (`Categories` → pick one), scroll the
right-hand sidebar past "Organize" — the same **SEO** card as Product SEO
sits there.

**What it controls**: same fields, same fallback behavior, same "leave it
empty and the intelligent default handles it" philosophy as Product SEO
above — see that section for the full field-by-field reference, it applies
identically here.

**One thing that works differently from products**: category listing
pages can be paginated (`/kouzina`, `/kouzina?page=2`, …). A **Canonical
URL** you set here only applies to page 1 — page 2 and beyond always point
back to their own URL, never to your override. This is deliberate: if page
2 claimed to be "the same as" your custom canonical, Google would treat it
as a duplicate and might stop indexing it, undoing the point of having
separate pages at all. In practice this means: only set a Canonical URL
override here if you have a specific reason to point the *first* page of
this category somewhere non-standard — leave it empty for the normal case.

---

## Homepage SEO

**Where**: a dedicated **SEO Αρχικής** entry in the left sidebar (not
attached to any other page — the homepage isn't a "thing" in the Medusa
Admin the way a product or category is, so it gets its own place instead
of living inside another screen).

**What it controls**: the same SEO fields as above, applied to the
storefront's `/` homepage. Leave everything empty and the homepage keeps
its current title/description (defined in the storefront's own code) —
nothing changes until you actually type something here.

**Note**: the homepage doesn't have pagination, so the Canonical URL field
here always applies directly — no page-1-only caveat like Category SEO
above.

---

## Site Settings

**Where**: **Ρυθμίσεις Καταστήματος** in the left sidebar — one page, five
sections.

**Announcement Bar**: a single line of text shown in a dark bar above the
header, on every page. Leave it empty and the bar doesn't appear at all —
there's no default text, so nothing shows until you type something real.
Keep it short; it doesn't wrap.

**Footer — Σύντομη περιγραφή καταστήματος**: replaces the one-sentence
description under the STIA logo in the footer. Leave empty and the
existing default description keeps showing.

**Στοιχεία Επικοινωνίας (Contact Details)**: Τηλέφωνο, Email, Διεύθυνση,
Ωράριο. Each one is independent — fill in just a phone number and only a
phone number appears, no placeholder or blank space for the others. Phone
becomes a real tap-to-call link, Email a real tap-to-email link, on mobile
and desktop both.

**Κοινωνικά Δίκτυα (Social Networks)**: Facebook / Instagram / TikTok
URLs. An icon for each filled-in URL appears in the footer, linking out in
a new tab; a URL left empty means no icon for that network.

**Καλάθι (Cart) — Μήνυμα καλαθιού**: a short line shown in the cart
drawer (the slide-out panel) and the full cart page, above the totals.
Leave it empty and nothing shows. This does **not** appear at checkout —
that screen is kept deliberately free of extra messaging so nothing
distracts from completing the order. This is a plain message, not a
free-shipping promise — the store's real shipping options don't currently
support a conditional free-shipping rule, so nothing here should claim one
(a general reassurance line — e.g. about secure packaging, or payment
method — is a safe use of this field; a specific "free shipping over €X"
claim is not, unless a real shipping rule backs it up).

**Note**: none of these fields are pre-filled from anything already in the
system — including the store's real pickup address/hours, which already
exist in code (`lib/pickup-config.ts`, used by checkout's Store Pickup
option) but are intentionally a separate concept from what shows in the
footer. If you want the footer's address/hours to match the pickup
location, type them in here yourself.

**Changes can take up to a minute to appear on the live storefront** (the
storefront caches this content briefly for performance) — if you save a
change and don't see it immediately, wait a minute and refresh before
assuming something went wrong.

---

## Content Pages

**Where**: **Σελίδες Περιεχομένου** in the left sidebar — a list of six
fixed pages (Σχετικά με εμάς, Αποστολές & Παράδοση, Επιστροφές & Αλλαγές,
Πολιτική Απορρήτου, Όροι Χρήσης, Συχνές Ερωτήσεις) down the left side,
click one to edit it on the right.

**Τίτλος (Title)**: shown as the page's big heading and browser tab title.

**Περιεχόμενο (Content)**: plain text — no special formatting buttons,
just type. A blank line between two lines starts a new paragraph; a
single line break within a block of text stays a line break (useful for,
e.g., an address or a short list). There's no bold/italic/links yet.

**Δημοσιευμένη (Published)**: the single most important toggle on this
page. **A page stays completely invisible on the live site — a real 404,
the same as if the page never existed — until you check this box and
save.** This is deliberate: writing a Privacy Policy or Terms of Service
takes time, and a half-written legal page live on the internet is worse
than no page at all. Write your content, review it, *then* check
Δημοσιευμένη.

**These six pages are fixed** — you can edit their title/content/publish
state, but you can't add a seventh page or rename the six from here. If
you need an additional page type, that's a small follow-up (each page
needs a matching spot in the storefront code, not just an admin entry).

**Important, especially for Πολιτική Απορρήτου and Όροι Χρήσης**: nothing
in this admin writes legal content for you — these two pages start
completely empty on purpose. Real Privacy Policy and Terms of Service text
should come from your own review (or a lawyer's), not be invented. The
other four (About, Shipping, Returns, FAQ) are lower-stakes but still
your own words to write.

---

## Homepage (Hero + Διαφημιστικές Ενότητες)

**Where**: **Αρχική Σελίδα** in the left sidebar — two sections on one
screen, Hero at the top and Διαφημιστικές Ενότητες (promo blocks) below.

**Hero (κεντρικό banner)**: the big banner at the very top of the
homepage. Click **+ Νέο** to add a slide. **Zero slides** = the store's
current default banner keeps showing, untouched. **One slide** = your
content replaces it, shown as a static banner. **Two or more slides** =
visitors get a swipeable/scrollable banner with dot indicators, cycling
through everything you've published, in the order set by "Σειρά
εμφάνισης" (lower numbers first).

**Διαφημιστικές Ενότητες**: the image-and-text sections that appear below
the category grid. Same logic — zero published blocks keeps the store's
original promo content, one or more replaces it entirely, shown in your
chosen order.

**Fields, both sections**:
| Field | What it does |
|---|---|
| Eyebrow | small label above the title (e.g. "Νέα Συλλογή") |
| Τίτλος | the headline |
| Κείμενο | the paragraph underneath |
| Κείμενο κουμπιού / Σύνδεσμος κουμπιού | the button's label and where it links to (e.g. `/kouzina`) |
| Εικόνα (URL) | a real image, if you have one hosted somewhere. Leave empty and a placeholder graphic is used instead — same as everywhere else with no real product photography yet |
| Σειρά εμφάνισης | a number — lower shows first |
| Δημοσιευμένο | **stays completely invisible until checked**, same rule as Content Pages: write and review before publishing |

**Leaving a field blank on a real slide/block leaves that piece out
entirely** — an empty Eyebrow means no eyebrow line shows, it does not
fall back to old default text. Only *zero* slides/blocks at all brings
back the store's original built-in content.

**Not covered here** (by design, not oversight): the "Παράδοση σε 2-3
εργάσιμες / Δωρεάν επιστροφές / Πληρωμή με αντικαταβολή" strip and the
"Μείνε ενημερωμένος" newsletter box aren't admin-editable. The delivery/
returns/payment strip states facts about what the store can actually do —
editing it here could make it say something checkout can't back up, so it
stays in code where it's kept in sync with the real fulfillment/payment
setup. The newsletter box isn't wired to a real email list yet.

---

## Product Merchandising

**Where**: open any product (`Products` → pick one), scroll the sidebar
past the existing **SEO** card — a second card, **Merchandising**, sits
below it.

**Ετικέτα (badge)**: a small label shown above the product's title on its
own page (not on category/listing pages yet — that's a known, deliberate
gap, see below). Distinct from the store's automatic "Νέο" and "Προσφορά"
badges, which you can't edit — those reflect real data (a genuinely recent
product, a genuine active discount) and stay that way on purpose.

**Χρώμα ετικέτας**: Ουδέτερο (neutral), Έμφαση (the brand accent color),
or Πράσινο — pick whichever reads right for the label you typed.

**Κείμενο εγγύησης / Σύνδεσμος Downloads**: shown in a new "Εγγύηση &
Downloads" section on the product page — a warranty statement and/or a
link to a downloadable manual (PDF or similar, hosted elsewhere and
linked to, not uploaded here). Leave both empty and the section doesn't
appear at all.

**Αναζήτηση (Search) — Απόκρυψη από την αναζήτηση**: check this and the
product never appears in search results, no matter what someone searches
for — useful for a product you're not ready to sell yet but don't want to
unpublish entirely.

**Αναζήτηση (Search) — Προτεραιότητα στα αποτελέσματα αναζήτησης**: check
this and the product jumps to the very top of results whenever it
genuinely matches what someone searched for. It does **not** make the
product appear for unrelated searches — it only changes where a real
match lands, never invents one. If a product is both hidden and boosted,
hidden wins (it never appears at all).

**Known gaps, not oversights**:
- The badge only shows on the product's own page right now, not on
  category pages or the homepage's product rows. Bringing it to those
  needs more backend work first (fetching many products' badges at once
  efficiently) — flagged as a real follow-up.
- There's no way yet to manually pick "customers who bought this also
  bought…" products for a specific item. The "Σχετικά προϊόντα" section
  every product page already has is fully automatic (same category), not
  admin-curated — a real curation tool is a separate, bigger piece of
  work, not built yet.

---

## Search Management

**Where**: **Αναζήτηση** in the left sidebar.

**What it's for**: teaching search that two different words mean the same
thing to your customers — e.g. someone typing the English "pan" should
still find products titled "Τηγάνι". Click **+ Νέα ομάδα συνωνύμων**,
type every word that should be treated as equivalent, separated by
commas (e.g. `τηγάνι, tigani, pan`), save. Order inside the group doesn't
matter — every term in it is fully interchangeable.

**Hiding a product from search, or boosting it to the top of results**:
not here — those are per-product settings, done on that product's own
page (see **Product Merchandising** above, the same "Merchandising" card
as the badge/warranty fields).

---

## Media Library

**Where**: **Βιβλιοθήκη Μέσων** in the left sidebar.

**What it's for**: a labeled list of image links you already have hosted
somewhere else (a CDN, an image host, wherever). Click **+ Νέα εικόνα**,
give it a short label (e.g. "Χειμερινό Banner") and paste the URL, save.
It's a reference list, not an upload tool — nothing gets uploaded or
stored here, you're just keeping track of URLs you already have so you
don't have to hunt for them again the next time an "Εικόνα (URL)" field
shows up somewhere (Αρχική Σελίδα, SEO, κ.λπ.). Copy the URL from here and
paste it into that field by hand.

**Why there's no upload button**: this store doesn't have real image
hosting set up yet (no real product photography exists either — see
`PROJECT_MEMORY.md` if you're technical and curious). Building an upload
feature without real hosting behind it would create images that only work
temporarily, not something safe to rely on for a real store — so this
stays a URL organizer until real hosting exists.

---

## Προωθητικό Banner (Promo Banner)

**Where**: **Προωθητικό Banner** in the left sidebar.

**What it's for**: a banner with a live countdown, shown at the very top
of the storefront (above the header, alongside the announcement bar), for
promoting something like a flash sale. **It does not create a discount by
itself** — set up the real discount in **Promotions** first (Medusa's own
built-in feature, already in this sidebar), then use this banner to
promote it with your own words and a matching end date/time.

**Fields**: Τίτλος (headline) and Κείμενο (body text) for the message,
Κείμενο κουμπιού / Σύνδεσμος κουμπιού for an optional button (e.g. linking
to the category on sale), and **Λήγει στις** — the exact date and time
the countdown reaches zero.

**Keep "Λήγει στις" matching your real Promotion's end date yourself** —
this field isn't connected to the actual Promotion, so if you change the
sale's real end date in Promotions, come back here and update this too,
or the countdown will say something that isn't true anymore.

**The banner disappears automatically once it expires** — even if you
forget to uncheck "Δημοσιευμένο," a banner past its "Λήγει στις" time
never shows on the live site, including for a visitor who already has the
page open when it expires (it vanishes without them needing to refresh).

---

*(Sections for Analytics/consent and every other phase get appended here
as they're built — see `TASKS.md` → "Admin-first platform" for what's
next.)*
