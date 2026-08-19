-- 0011_journal.sql
--
-- The Journal: a dated, categorised, image-rich editorial content system.
--
-- Deliberately NOT an extension of shop.content_page. That table is a CLOSED
-- set of eleven slugs (see CONTENT_PAGE_SLUGS in lib/admin/cms.ts), each
-- requiring its own literal route folder, carrying only title + plain body +
-- is_published. It has no slug creation, no dates, no categories, no images
-- and no ordering — every one of which the Journal needs. Forcing an
-- open-ended, growing article system through it would mean breaking the one
-- invariant that makes it safe ("every slug has a route"), so this is its own
-- pair of tables instead.
--
-- What IS reused rather than duplicated: shop.seo_meta. Per-article SEO
-- title / meta description / canonical / OG / robots all live there under
-- resource_type = 'journal_article', exactly like products and categories
-- already do — so there is one SEO storage shape in the database, not two.
-- The only change needed for that is widening the existing CHECK constraint.

-- ---------------------------------------------------------------------------
-- Categories — owner-created, never hardcoded
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shop.journal_category (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Articles
-- ---------------------------------------------------------------------------
--
-- status + published_at, not a single boolean: a future published_at on a
-- 'published' row is a scheduled post, and the storefront's own WHERE clause
-- (published_at <= now()) is the whole scheduling mechanism. No cron, no job
-- queue — the storefront renders per request, so an article simply starts
-- being visible when its time passes.
--
-- category_id ON DELETE SET NULL rather than CASCADE: deleting a category
-- must never delete the owner's writing. An uncategorised article still
-- renders, it just drops out of the category listing.
--
-- related_product_slugs is a text[] of product slugs, not a join table. It
-- matches the wire format the existing admin ProductPicker already produces
-- (newline-separated slugs, as shop.homepage_block's manual product rail
-- stores them in its config jsonb), and the storefront resolves it with the
-- existing getProductsBySlugs — which already preserves the requested order,
-- i.e. the order the owner arranged. A join table would buy referential
-- integrity we would then have to hand-maintain in the picker, for a list
-- that is at most a handful of items and is purely presentational.

CREATE TABLE IF NOT EXISTS shop.journal_article (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text NOT NULL UNIQUE,
  title                 text NOT NULL,
  excerpt               text,
  body                  text,
  category_id           uuid REFERENCES shop.journal_category(id) ON DELETE SET NULL,
  hero_image_path       text,
  hero_image_alt        text,
  author                text,
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published')),
  published_at          timestamptz,
  is_featured           boolean NOT NULL DEFAULT false,
  related_product_slugs text[] NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- The storefront's only listing query shape: live articles, newest first.
-- Partial index because drafts are never listed publicly and there will
-- always be far fewer published articles than the table eventually holds.
CREATE INDEX IF NOT EXISTS journal_article_live_idx
  ON shop.journal_article (published_at DESC)
  WHERE status = 'published';

-- Category listing pages and the "related articles" lookup both filter on it.
CREATE INDEX IF NOT EXISTS journal_article_category_idx
  ON shop.journal_article (category_id);

-- ---------------------------------------------------------------------------
-- SEO — widen the existing polymorphic table instead of adding columns here
-- ---------------------------------------------------------------------------

ALTER TABLE shop.seo_meta DROP CONSTRAINT IF EXISTS seo_meta_resource_type_check;
ALTER TABLE shop.seo_meta
  ADD CONSTRAINT seo_meta_resource_type_check
  CHECK (resource_type IN ('product', 'category', 'collection', 'page', 'homepage', 'journal_article'));

-- ---------------------------------------------------------------------------
-- updated_at triggers, matching 0001_init's convention
-- ---------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['journal_category', 'journal_article'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON shop.%I', t || '_touch', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON shop.%I
         FOR EACH ROW EXECUTE FUNCTION shop.touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- RLS is enforced (and repaired if missing) by db/migrate.mjs after every
-- run, so both new tables are covered by the same zero-policy lockdown as
-- the rest of the schema without repeating the ALTER here.
