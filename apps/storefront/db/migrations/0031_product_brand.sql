-- SEO-008: products had no brand field, so Product JSON-LD could never say who
-- makes an item. Nullable on purpose, with no default: most of the catalog is
-- unbranded stock today, and an unset brand is omitted from structured data
-- rather than guessed — stamping the store's own name onto a third-party
-- product would publish a false manufacturer. Same plain nullable-text shape
-- as the other owner-entered characteristics (material, origin_country).
ALTER TABLE shop.product
  ADD COLUMN IF NOT EXISTS brand text;
