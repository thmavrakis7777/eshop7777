/**
 * How long the storefront's cached data (`unstable_cache`) lives before it is
 * refetched on its own. Every dashboard save already refreshes what it
 * changed at once (revalidatePath / updateTag), so this is only the safety
 * net for changes no save reaches.
 *
 * It has to match the pages' own `revalidate` (86400, in the storefront
 * layout): Next gives a cached page the SHORTEST lifetime of any cached data
 * it reads. These used to be 30–60 s, which quietly turned every page's one
 * hour into 30 s, so nearly every visit (mostly crawlers) re-rendered and
 * re-stored a whole page. That used 75% of the Hobby plan's ISR writes and
 * Active CPU in three weeks (2026-11-08).
 */
export const STOREFRONT_DATA_REVALIDATE = 86_400;

/**
 * The journal keeps one hour: a scheduled article (a future published_at)
 * has no job that publishes it, it simply appears once the cache refetches.
 * Only the journal's own few pages read this data.
 */
export const JOURNAL_DATA_REVALIDATE = 3_600;
