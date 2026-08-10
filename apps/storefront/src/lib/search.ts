// Greek-aware search: normalization, bounded fuzzy matching, and tiered
// ranking — all in plain TypeScript, no dependency. Medusa's own `q` param
// is a database-level ILIKE match: case-insensitive but not accent-
// insensitive, no fuzzy tolerance, no controllable ranking. Greek customers
// routinely type without tonos ("σεντονια" for "Σεντόνια"), so this layer
// sits in front of the (small, cached) product catalog instead — see
// lib/data/products.ts's searchProducts() for where it's used.

// Unicode NFD decomposition splits each accented letter into its base
// letter + a combining diacritical mark, which the regex then strips — a
// robust, general technique, not a hardcoded per-character replacement
// table. `toLowerCase()` handles Greek case folding; the extra sigma fold
// covers a real gap NFD/lowercasing alone doesn't close (word-final "ς" is
// a distinct codepoint from "σ", not an accent variant of it).
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/\s+/g, " ")
    .trim();
}

// Bounded edit distance: returns true only if `a`/`b` are within
// `maxDistance` edits, bailing out early (both on the length gate and mid-
// computation once a whole row already exceeds the bound) rather than
// computing a full distance matrix for an obviously-too-different pair.
function withinLevenshteinDistance(a: string, b: string, maxDistance: number): boolean {
  if (Math.abs(a.length - b.length) > maxDistance) return false;

  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > maxDistance) return false;
    prev = curr;
  }
  return prev[b.length] <= maxDistance;
}

// How many edits a word "forgives" before it stops being a plausible typo of
// the query — scaled to length so a 2-edit slip on a long word is still
// tight relative to its size, while a short word doesn't tolerate an edit
// that would basically make it a different word.
function wordDistanceThreshold(wordLength: number): number {
  if (wordLength <= 4) return 1;
  if (wordLength <= 8) return 2;
  return 3;
}

export type SearchTier =
  | "sku-exact"
  | "sku-partial"
  | "title-exact"
  | "title-prefix"
  | "title-word"
  | "category"
  | "fuzzy";

// Lower is better — mirrors the priority order requested for this feature:
// exact SKU, then partial SKU, then increasingly loose title matches,
// then category, then bounded fuzzy as a last resort.
export const SEARCH_TIER_RANK: Record<SearchTier, number> = {
  "sku-exact": 0,
  "sku-partial": 1,
  "title-exact": 2,
  "title-prefix": 3,
  "title-word": 4,
  category: 5,
  fuzzy: 6,
};

export type SearchIndexEntry = {
  normalizedTitle: string;
  titleWords: string[];
  normalizedSkus: string[];
  normalizedCategoryNames: string[];
};

export function buildSearchIndexEntry(input: {
  title: string;
  skus: Array<string | null | undefined>;
  categoryNames: string[];
}): SearchIndexEntry {
  const normalizedTitle = normalizeSearchText(input.title);
  return {
    normalizedTitle,
    titleWords: normalizedTitle.split(" ").filter(Boolean),
    normalizedSkus: input.skus.filter((s): s is string => Boolean(s)).map(normalizeSearchText),
    normalizedCategoryNames: input.categoryNames.map(normalizeSearchText),
  };
}

// Returns the single best matching tier, or null for no match at all.
// Deliberately doesn't blend signals into a fuzzy numeric score — every
// match is explainable as "this tier matched", which is what makes the
// priority order predictable instead of an opaque ranking.
export function matchTier(normalizedQuery: string, entry: SearchIndexEntry): SearchTier | null {
  if (!normalizedQuery) return null;

  if (entry.normalizedSkus.some((sku) => sku === normalizedQuery)) return "sku-exact";
  if (entry.normalizedSkus.some((sku) => sku.includes(normalizedQuery))) return "sku-partial";
  if (entry.normalizedTitle === normalizedQuery) return "title-exact";
  if (entry.normalizedTitle.startsWith(normalizedQuery)) return "title-prefix";
  if (entry.titleWords.some((w) => w.startsWith(normalizedQuery))) return "title-word";
  if (entry.normalizedCategoryNames.some((c) => c.includes(normalizedQuery))) return "category";

  // Only bother fuzzy-matching once the query is long enough that a 1-2
  // edit match means something — a 2-character query "fuzzy-matching"
  // half the catalog's short words would be noise, not typo tolerance,
  // which is exactly the over-aggressive behavior to avoid.
  if (normalizedQuery.length >= 3) {
    const threshold = wordDistanceThreshold(normalizedQuery.length);
    const fuzzyTitle = entry.titleWords.some((w) => withinLevenshteinDistance(normalizedQuery, w, threshold));
    const fuzzySku = entry.normalizedSkus.some((sku) => withinLevenshteinDistance(normalizedQuery, sku, threshold));
    if (fuzzyTitle || fuzzySku) return "fuzzy";
  }

  return null;
}

// Generic over the caller's item shape so both the dropdown preview and the
// full /anazitisi results page can share one ranking pass without either
// depending on the other's types. `tieBreak` orders same-tier matches
// (normalized title works well — alphabetical within a tier, in the
// customer's own alphabet since it's already Greek-folded).
export function rankSearchMatches<T>(
  query: string,
  entries: Array<{ entry: SearchIndexEntry; item: T; tieBreak: string }>
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  return entries
    .map(({ entry, item, tieBreak }) => {
      const tier = matchTier(normalizedQuery, entry);
      return tier ? { item, rank: SEARCH_TIER_RANK[tier], tieBreak } : null;
    })
    .filter((m): m is { item: T; rank: number; tieBreak: string } => m !== null)
    .sort((a, b) => a.rank - b.rank || a.tieBreak.localeCompare(b.tieBreak, "el"))
    .map((m) => m.item);
}
