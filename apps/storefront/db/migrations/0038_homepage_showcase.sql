-- 0038_homepage_showcase.sql
--
-- Adds the Editorial Showcase homepage section (components/home/
-- EditorialShowcase.tsx): an editorial composition — a large image or large
-- product photos, a heading and real products from a chosen source
-- (category, collection, sale, new arrivals, best sellers or hand-picked).
-- It can be added any number of times.
--
-- Only the CHECK widens. Everything specific to the kind (layout, image
-- side, tone, product source) lives in the existing `config` jsonb, and the
-- copy/image/button reuse the block's shared columns — the same split every
-- other kind uses (see 0004).
--
-- Safe to apply before the code that renders it is deployed: a storefront
-- that doesn't know the kind renders nothing for it.

ALTER TABLE shop.homepage_block
  DROP CONSTRAINT IF EXISTS homepage_block_kind_check;

ALTER TABLE shop.homepage_block
  ADD CONSTRAINT homepage_block_kind_check
  CHECK (kind IN (
    'hero', 'promo', 'category_grid', 'product_rail', 'content',
    'trust', 'newsletter', 'showcase'
  ));
