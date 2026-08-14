import { normalizeSearchText } from "@/lib/search";

// Synonym expansion. The synonym *groups* now come from SQL
// (lib/db/catalog.ts's getSearchSynonymGroups) and search boost/hide flags
// are plain columns on shop.product, so the two fetch helpers that used to
// live here are gone — this file is down to the one piece of pure logic.

/**
 * If the query matches any term in a group (case/accent-insensitive exact
 * match on the raw term, using the same normalization rankSearchMatches
 * applies internally), returns every term in that group as search
 * candidates; otherwise just the original query unchanged.
 */
export function expandQueryWithSynonyms(query: string, groups: string[][]): string[] {
  const normalized = normalizeSearchText(query);
  const match = groups.find((group) => group.some((term) => normalizeSearchText(term) === normalized));
  return match ?? [query];
}
