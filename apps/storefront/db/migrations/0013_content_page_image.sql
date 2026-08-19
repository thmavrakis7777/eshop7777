-- 0013_content_page_image.sql
--
-- The About page needs an editable hero image (E-E-A-T/trust signal, and
-- the owner explicitly wants to replace it from the dashboard) but
-- shop.content_page had no image column at all — only title/body/
-- is_published. Adds one optional image (+ alt text) any of the 13 content
-- pages can use, not just About; a page with no image just renders without
-- one, same "nothing forced" pattern as Journal's featured image.
--
-- Path, not URL, matching every other image column in this schema
-- (product.image_path, category.image_path, journal_article.hero_image_path,
-- site_setting.logo_path, …) — lib/storage/urls.ts derives the public URL at
-- render time, so moving bucket or adding a CDN never means rewriting rows.

ALTER TABLE shop.content_page
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS image_alt  text;
