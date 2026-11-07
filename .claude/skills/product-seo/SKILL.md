---
name: product-seo
description: Writes a MAVRAKIS HOME product's description, SEO title, meta description, H1, slug and main-photo alt text (or a category's description, SEO title and meta), the way the admin's «SEO + GEO» AI button does, using the shop's keyword map of the words Greek shoppers really search (inox/ανοξείδωτο, καμινέτο/γκαζάκι…), then saves them to the live shop after the owner approves. Use when the owner says «seo skill <code>» (one or more product codes such as 00085) or names a category, types /product-seo, or asks for SEO texts "like the button made for the others".
---

# Product SEO (like the SEO + GEO + AEO button)

The owner gives one or more product codes (the SKU shown as «Κωδικός», e.g. `00085`). For each, write the 6 fields with the same rules as the admin's AI button, show the draft, and save **only after the owner says OK**. The save goes to the **live** shop database.

Answer the owner in Greek-friendly plain language; keep code/table names out of the explanation unless asked.

## 1. Load the product (Supabase, project `tuvbesrqizixqrunvlnt`)

Load the Supabase `execute_sql` tool if needed. `shop.seo_meta.resource_id` is **text** — cast `p.id::text`.

```sql
SELECT v0.sku, p.id, p.slug, p.title, p.description, p.is_active, p.material, p.brand,
       p.weight_grams, p.length_cm, p.width_cm, p.height_cm, p.origin_country, p.warranty_text,
       c.name AS cat, pc.name AS parent_cat, s.seo_title, s.meta_description,
       (SELECT json_agg(json_build_object('id', i.id, 'alt', i.alt_text, 'pos', i.position, 'path', i.storage_path) ORDER BY i.position)
          FROM shop.product_image i WHERE i.product_id = p.id) AS imgs,
       (SELECT json_agg(json_build_object('sku', v.sku, 'title', v.title, 'price', v.price_cents, 'compare', v.compare_at_price_cents))
          FROM shop.product_variant v WHERE v.product_id = p.id) AS variants
  FROM shop.product p
  JOIN shop.product_variant v0 ON v0.product_id = p.id
  LEFT JOIN shop.category c ON c.id = p.category_id
  LEFT JOIN shop.category pc ON pc.id = c.parent_id
  LEFT JOIN shop.seo_meta s ON s.resource_type = 'product' AND s.resource_id = p.id::text
 WHERE v0.sku = '<code>';
```

If the product already has a description / SEO title, say so and ask before overwriting. If it has sibling products (same name, other size/colour), load them too: the texts must differ from theirs.

## 2. Look at the main photo

Download the position-0 image into the scratchpad (its own new folder) and open it with Read:
`https://tuvbesrqizixqrunvlnt.supabase.co/storage/v1/object/public/product-images/<storage_path>`

Use the photo only for **real product features you can see** (parts, colour, finish, what is included).

## 3. Read the house style

Load 3–5 finished products from the same parent category (description and seo_title not null) and match their tone and length. Vary the opening — don't start every description the same way (e.g. not always «Ανανεώστε…»).

## 3b. Pick the search terms

Read [keywords.md](keywords.md): which word goes in which field, the variant pairs per area, and the truth rules (inox only for real stainless, non-stick only for a real coating). For this product decide:

- the **main term** (usually the word already in the product/category name) → SEO title and H1;
- the **variant(s)** that really name the same thing → once in the meta, once in the description;
- whether siblings already carry the same variant sentence — if so, word it differently or leave it out. **Not the same pattern on every product.**

Never claim one term is searched more without data. If the owner gives real data (Search Console, Keyword Planner), update keywords.md.

## 4. Write the 6 fields

The button's source of truth: `apps/storefront/src/lib/ai/gemini-provider.ts` (systemPrompt, fieldDescriptions). Its rules, plus the owner's own:

- **Facts:** only what the DB holds and what the photo really shows. Never invent sizes, thread sizes, pressure, compatibility, certifications, warranty, "best seller" claims. If a fact a shopper would want is missing, **ask the owner** instead of guessing.
- **Description:** 2–4 natural Greek sentences, original wording, no keyword lists, no hype («το καλύτερο»). Include one sentence that answers the shopper's real question (GEO/AEO), e.g. why this size over the other one, where it fits, what it replaces. Correct Greek article/ν rules («την μπαταρία», «στην μπανιέρα»).
- **Other products:** point to another product only when it is a true sibling (same item in another size/colour, e.g. 00089 ↔ 00090). Don't send the shopper to a different product of the same category (owner removed «υπάρχει και το λευκό καλάθι των 65 λίτρων» from 00092).
- **SEO title:** the strongest commercial term + a key feature (type + size / colour / material / use), ending in **` | MAVRAKIS HOME`**, max **60** characters. A second variant only if it still reads as a natural title (owner's example: «Μπρίκι Inox 350ml – Ανοξείδωτο για Ελληνικό Καφέ | MAVRAKIS HOME»), never a list of synonyms. A product's own SEO title is used as an absolute title — the site's «| storeName» suffix is skipped — so the shop name must be written in.
- **Meta description:** max **155** characters, explains the product, no clickbait. Main term + one real synonym from keywords.md.
- **Variants in the description:** each relevant variant once, where it reads naturally — not a list, not every sibling the same sentence.
- **H1:** the real product name, close to the current title, capitalised like the other products (e.g. «Σπιράλ Inox Μπάνιου 2m»). No keywords stuffed in.
- **Slug:** lowercase Latin, digits, hyphens. **Keep the current slug if the product is published** and it is already descriptive; change only if it is wrong.
- **Name the visible finish:** shiny chrome fittings are «χρωμέ ρακόρ», not the vaguer «μεταλλικά ρακόρ» (owner's correction on 00087). Same idea for any part whose finish the photo clearly shows. But shiny ≠ always chrome: gas-stove/καμινέτο **grates (σχάρες) are «ανοξείδωτη»**, never «χρωμέ» (owner's correction on 00089/00090).
- **Alt text:** what the product **is** — type, material, colour, size, visible parts. **Never how the photo shows it**: no pose, arrangement or background («τυλιγμένο σε κύκλο», «πάνω σε πάγκο», «σε μαρμάρινο φόντο»). Owner's rule.

## 5. Run the button's checks

Write the draft to the scratchpad as JSON (`h1`, `seoTitle`, `metaDescription`, `description`, `slug`, `imageAlt`) and run:

```bash
node .claude/skills/product-seo/scripts/check.mjs <draft.json>
```

It must print `OK`. If it fails (e.g. a word repeated too often — «στην», «όταν» count too), rewrite and re-run.

## 6. Show the draft, then wait

Show all 6 fields (with character counts for SEO title and meta), one line on why, and anything you need the owner to confirm. **Do not save until the owner says OK.** Apply any correction they give, and if it is a general rule, add it to section 4 of this file.

## 7. Save (only after OK)

One transaction, the same writes as the button's save (`saveAiSeoContentAction` in `apps/storefront/src/lib/admin/ai-seo-actions.ts`). Use dollar quoting for the Greek text:

```sql
BEGIN;
UPDATE shop.product SET title = $t$<h1>$t$, description = $d$<description>$d$ /*, slug = '<slug>' only if changed */
 WHERE id = '<product id>';
INSERT INTO shop.seo_meta (resource_type, resource_id, seo_title, meta_description)
VALUES ('product', '<product id>', $s$<seoTitle>$s$, $m$<metaDescription>$m$)
ON CONFLICT (resource_type, resource_id) DO UPDATE SET
  seo_title = EXCLUDED.seo_title, meta_description = EXCLUDED.meta_description, updated_at = now();
UPDATE shop.product_image SET alt_text = $a$<imageAlt>$a$
 WHERE id = '<position-0 image id>' AND product_id = '<product id>';
COMMIT;
```

If the slug changes, first check no other product uses it. Then read the row back and show the owner the saved values. Tell them the product page shows the new text within an hour (pages are cached for 3600 s); saving the product once in the admin refreshes it immediately.

## 8. Categories and subcategories

Same rules, three fields — the ones the category button writes (`ai-category-seo-actions.ts`): **description**, **SEO title**, **meta description**. No H1/slug/alt.

- Load: `shop.category` (name, slug, description, parent) + `shop.seo_meta` (`resource_type = 'category'`, `resource_id = id::text`), and the active products in it and below it — the text must describe what is really there.
- **Only work on categories that have products.** An empty category is `noindex` and out of the sitemap, so new text changes nothing until a product arrives; say so instead of rewriting it.
- **Owner's own texts** (Αντιγραφή Κλειδιών, Κλειδαριές, Κύλινδροι, Λουκέτα, the top-level ones): propose, never overwrite without an explicit OK.
- **Ηράκλειο** only in top-level categories and in subcategories with real local intent (same-day need, bring the old part). Don't add it elsewhere.
- Description: 3–4 sentences. The category carries the broad synonym (e.g. «γκαζάκια» on Καμινέτα) so the products don't all have to.
- SEO title is absolute here too (`lib/category-route.ts`) → end with ` | MAVRAKIS HOME`, ≤60.
- Check with the same script (put the category text in `description`, `seoTitle`, `metaDescription`; fill `h1` with the category name, `slug` with its slug and `imageAlt` with the name so the script runs).
- Back up the old values to `backups/<date>-<topic>/` (gitignored) before saving. Save:

```sql
BEGIN;
UPDATE shop.category SET description = $d$<description>$d$ WHERE id = '<category id>';
INSERT INTO shop.seo_meta (resource_type, resource_id, seo_title, meta_description)
VALUES ('category', '<category id>', $s$<seoTitle>$s$, $m$<metaDescription>$m$)
ON CONFLICT (resource_type, resource_id) DO UPDATE SET
  seo_title = EXCLUDED.seo_title, meta_description = EXCLUDED.meta_description, updated_at = now();
COMMIT;
```

The category page picks it up within about a minute.
