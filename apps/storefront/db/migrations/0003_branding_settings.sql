-- 0003_branding_settings.sql
--
-- Makes store branding fully admin-editable, closing a real gap: `store_name`
-- and `logo_path` already existed on site_setting and were already written by
-- the admin form, but the storefront's getSiteSettings() never SELECTed them
-- and the SiteSettings type had no field for them — so changing the shop name
-- in the dashboard wrote to the database and changed nothing on the site.
-- Every visible "STIA" was an independent hardcoded literal instead.
--
-- The four columns added here are the ones that had no home at all:
--
--   * favicon_path      — browser tab icon.
--   * og_image_path     — default social-share image, used when a page has no
--                         SEO override image of its own. Deliberately NOT in
--                         seo_meta: that table is per-resource overrides, this
--                         is the site-wide default they fall back to.
--   * default_seo_title / default_seo_description
--                       — previously hardcoded as TS constants in
--                         lib/site-config.ts (siteDefaultTitle/Description),
--                         which cannot be changed without a deploy.
--
-- Paths, not URLs, matching the existing logo_path/image_path convention
-- (lib/storage/urls.ts derives the public URL at render time, so moving bucket
-- or adding a CDN never rewrites rows). An absolute http(s) URL still passes
-- through unchanged, so these are usable before Supabase Storage is set up.
--
-- Additive only: no existing column is changed or dropped.

ALTER TABLE shop.site_setting
  ADD COLUMN IF NOT EXISTS favicon_path text,
  ADD COLUMN IF NOT EXISTS og_image_path text,
  ADD COLUMN IF NOT EXISTS default_seo_title text,
  ADD COLUMN IF NOT EXISTS default_seo_description text;
