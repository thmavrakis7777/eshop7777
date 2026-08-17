-- 0006_seed_fixed_sections.sql
--
-- Fixes a real regression introduced with the section system: the trust
-- strip and newsletter band used to be hardcoded at the bottom of the
-- homepage, and 0005 made them ordinary sections. But a store that already
-- had sections configured then rendered NEITHER — the hardcoded pair was
-- gone and no trust/newsletter rows existed to replace them, so the live
-- homepage silently lost its footer content.
--
-- Seeds one of each, published, at the end of the order — matching exactly
-- where they used to sit. Idempotent: only inserts a kind that has no row
-- yet, so re-running (or a store that has already added its own) is a
-- no-op rather than a duplicate.
--
-- Deliberately seeded for every store, not only ones with sections: a store
-- with none renders the fallback homepage, which includes this pair anyway,
-- so having the rows present means the owner can immediately reorder or
-- hide them instead of first having to discover they exist.

INSERT INTO shop.homepage_block (kind, sort_order, is_published)
SELECT 'trust', COALESCE((SELECT MAX(sort_order) FROM shop.homepage_block), 0) + 10, true
 WHERE NOT EXISTS (SELECT 1 FROM shop.homepage_block WHERE kind = 'trust');

INSERT INTO shop.homepage_block (kind, sort_order, is_published)
SELECT 'newsletter', COALESCE((SELECT MAX(sort_order) FROM shop.homepage_block), 0) + 10, true
 WHERE NOT EXISTS (SELECT 1 FROM shop.homepage_block WHERE kind = 'newsletter');
