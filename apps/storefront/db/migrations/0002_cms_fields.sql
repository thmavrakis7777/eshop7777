-- 0002_cms_fields.sql
--
-- Three columns the initial schema dropped but the storefront actually
-- consumes. Found by checking real call sites rather than by trusting the
-- audit's table sketch:
--
--   * seo_meta.structured_data_override — merged into the PDP's Product
--     JSON-LD (app/proionta/[handle]/page.tsx), so dropping it would have
--     silently degraded structured data.
--   * product.badge_tone      — drives the PDP badge's colour variant.
--   * product.downloads_url   — rendered by components/product/ProductWarranty.
--
-- Additive only: no existing column changes, nothing rewritten.

ALTER TABLE shop.seo_meta
  ADD COLUMN IF NOT EXISTS structured_data_override jsonb;

ALTER TABLE shop.product
  ADD COLUMN IF NOT EXISTS badge_tone text NOT NULL DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS downloads_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_badge_tone_check'
  ) THEN
    ALTER TABLE shop.product
      ADD CONSTRAINT product_badge_tone_check
      CHECK (badge_tone IN ('accent', 'success', 'neutral'));
  END IF;
END $$;
