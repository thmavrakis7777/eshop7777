-- 0010_category_landing_pages.sql
--
-- Lets a category be a content/service landing page instead of a product
-- listing. EXTENDS shop.category rather than adding a new table: neither of
-- the two existing content mechanisms fit a real local-SEO landing page
-- (Αντιγραφή Κλειδιών Σπιτιού under Κλειδιά & Ασφάλεια) —
-- shop.content_page is a closed enum of 11 hardcoded slugs each requiring
-- its own literal route file, and the homepage block builder only renders
-- on the homepage. A category, on the other hand, already gets breadcrumbs,
-- nav, canonical URLs and sitemap inclusion for free, and "a category with
-- no products" is a real, if rare, state the schema already tolerated.
--
-- page_type defaults to 'products' so every existing category (and every
-- future one created the normal way) keeps rendering exactly as it does
-- today — this is additive, not a behaviour change. 'landing' is the one
-- opt-in flag the storefront route branches on to render curated content
-- (hero copy, FAQ, CTA) instead of an empty product grid.
--
-- faq is a nullable array of {question, answer}. Kept generic (not named
-- after this one page) because any category could reasonably carry an FAQ
-- later, landing or not — the storefront only renders it, and only emits
-- FAQPage JSON-LD, when it is actually present and non-empty, so a normal
-- product category with no FAQ set is completely unaffected.
--
-- image_path already exists on this table (0001_init) but was never wired
-- into the admin UI — no schema change needed for the optional hero image.

ALTER TABLE shop.category
  ADD COLUMN IF NOT EXISTS page_type text NOT NULL DEFAULT 'products'
    CHECK (page_type IN ('products', 'landing')),
  ADD COLUMN IF NOT EXISTS faq jsonb;
