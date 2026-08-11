import { medusaFetch } from "@/lib/medusa";
import { normalizeSearchText } from "@/lib/search";

// Admin-first platform, Phase H. Both never throw — a failed fetch means
// "no overrides, no synonyms," the same honest fallback as everywhere
// else admin config is optional decoration on top of real data.

export type SearchOverrides = { hidden: Set<string>; boosted: Set<string> };

export async function getSearchOverrides(): Promise<SearchOverrides> {
  try {
    const { hidden, boosted } = await medusaFetch<{ hidden: string[]; boosted: string[] }>(
      "/store/product-extras/search-overrides",
      { next: { revalidate: 60 } }
    );
    return { hidden: new Set(hidden), boosted: new Set(boosted) };
  } catch {
    return { hidden: new Set(), boosted: new Set() };
  }
}

// Each group is the raw comma-separated term list — expandQuery below
// does the splitting/matching, so a caller that only wants to know
// "should I even look for a group" never has to un-parse anything twice.
export async function getSearchSynonymGroups(): Promise<string[][]> {
  try {
    const { synonyms } = await medusaFetch<{ synonyms: { terms: string }[] }>("/store/search-synonyms", {
      next: { revalidate: 300 },
    });
    return synonyms
      .map((s) => s.terms.split(",").map((t) => t.trim()).filter(Boolean))
      .filter((group) => group.length > 1);
  } catch {
    return [];
  }
}

// If the query matches any term in a group (case/accent-insensitive
// exact match on the raw term, same normalization rankSearchMatches
// applies internally), returns every term in that group as search
// candidates; otherwise just the original query unchanged.
export function expandQueryWithSynonyms(query: string, groups: string[][]): string[] {
  const normalized = normalizeSearchText(query);
  const match = groups.find((group) => group.some((term) => normalizeSearchText(term) === normalized));
  return match ?? [query];
}
