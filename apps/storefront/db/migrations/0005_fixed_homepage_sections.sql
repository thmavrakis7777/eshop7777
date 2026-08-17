-- 0005_fixed_homepage_sections.sql
--
-- Lets the trust strip and newsletter band be positioned and hidden like any
-- other homepage section, instead of being permanently pinned to the bottom
-- of the page in JSX.
--
-- Their *content* stays curated in code on purpose, which is why they are
-- their own kinds rather than `content` blocks:
--
--   * trust — its four claims (delivery window, returns policy, payment
--     method, support hours) must match what checkout can actually deliver.
--     TrustStrip.tsx's own comment records that an earlier version promised
--     two payment methods checkout could not offer. Making these free text
--     invites exactly that class of mistake, so the owner gets position and
--     visibility control, not copy control.
--   * newsletter — the signup form has no real submit handler yet, so
--     editable copy would advertise something that doesn't work.
--
-- Both remain a single migration away from becoming fully editable if that
-- changes: widen the CHECK, add the fields to the config jsonb.

ALTER TABLE shop.homepage_block
  DROP CONSTRAINT IF EXISTS homepage_block_kind_check;

ALTER TABLE shop.homepage_block
  ADD CONSTRAINT homepage_block_kind_check
  CHECK (kind IN (
    'hero', 'promo', 'category_grid', 'product_rail', 'content',
    'trust', 'newsletter'
  ));
