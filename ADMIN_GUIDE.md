# Admin Guide

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

*(Sections for Site Settings, Content Pages, Homepage CMS, and every other
phase get appended here as they're built — see `TASKS.md` → "Admin-first
platform" for what's next.)*
