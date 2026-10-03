-- Sitemap <lastmod> for category pages (app/sitemap.ts). Google only trusts a
-- lastmod that moves when the page really changes, so it can't come from
-- shop.category.updated_at: the category_touch trigger bumps that on every
-- UPDATE, including the two writes that change nothing a visitor sees —
-- pressing Save in the category editor without editing anything, and moving
-- a category up or down (moveCategory swaps sort_order on two rows).
--
-- content_updated_at moves only when something the page shows changed: its
-- name/slug (H1, URL), description, image, FAQ, page type, parent or active
-- state. sort_order and the view-all/promo settings (separate tables) are
-- deliberately not in the list. The same idea for shop.seo_meta, whose
-- updated_at saveCategorySeo sets on every save: content_updated_at there
-- moves only when a title/meta/robots/canonical/social field changed.
--
-- Both start from the rows' current updated_at — the best value available
-- for history recorded before this column existed.

ALTER TABLE shop.category ADD COLUMN IF NOT EXISTS content_updated_at timestamptz;
UPDATE shop.category SET content_updated_at = updated_at WHERE content_updated_at IS NULL;
ALTER TABLE shop.category
  ALTER COLUMN content_updated_at SET DEFAULT now(),
  ALTER COLUMN content_updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION shop.touch_category_content() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.name, NEW.slug, NEW.description, NEW.image_path, NEW.faq, NEW.page_type, NEW.parent_id, NEW.is_active)
     IS DISTINCT FROM
     (OLD.name, OLD.slug, OLD.description, OLD.image_path, OLD.faq, OLD.page_type, OLD.parent_id, OLD.is_active) THEN
    NEW.content_updated_at = now();
  ELSE
    NEW.content_updated_at = OLD.content_updated_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS category_content_touch ON shop.category;
CREATE TRIGGER category_content_touch BEFORE UPDATE ON shop.category
  FOR EACH ROW EXECUTE FUNCTION shop.touch_category_content();

ALTER TABLE shop.seo_meta ADD COLUMN IF NOT EXISTS content_updated_at timestamptz;
UPDATE shop.seo_meta SET content_updated_at = updated_at WHERE content_updated_at IS NULL;
ALTER TABLE shop.seo_meta
  ALTER COLUMN content_updated_at SET DEFAULT now(),
  ALTER COLUMN content_updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION shop.touch_seo_meta_content() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.seo_title, NEW.meta_description, NEW.canonical_url, NEW.og_title, NEW.og_description,
      NEW.social_image_path, NEW.keywords, NEW.robots, NEW.structured_data_override)
     IS DISTINCT FROM
     (OLD.seo_title, OLD.meta_description, OLD.canonical_url, OLD.og_title, OLD.og_description,
      OLD.social_image_path, OLD.keywords, OLD.robots, OLD.structured_data_override) THEN
    NEW.content_updated_at = now();
  ELSE
    NEW.content_updated_at = OLD.content_updated_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seo_meta_content_touch ON shop.seo_meta;
CREATE TRIGGER seo_meta_content_touch BEFORE UPDATE ON shop.seo_meta
  FOR EACH ROW EXECUTE FUNCTION shop.touch_seo_meta_content();
