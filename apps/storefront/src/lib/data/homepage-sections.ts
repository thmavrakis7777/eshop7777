import { getHomepageSections } from "@/lib/db/content";
import {
  getFeaturedProducts,
  getFeaturedProductsPaged,
  getNewArrivals,
  getProductsByCategoryHandle,
  getProductsByCollectionHandle,
  getProductsByHandles,
} from "@/lib/data/products";
import type { HomepageSection, ProductRailSource } from "@/lib/content-types";
import type { Product } from "@/lib/types";

export { getHomepageSections };
export type { HomepageSection };

const DEFAULT_LIMIT = 12;
// A rail is a horizontally-scrolled strip, not a listing page — past ~24 the
// query cost and payload grow for products nobody scrolls to. Also stops a
// hand-edited config row from pulling the whole catalogue onto the homepage.
const MAX_LIMIT = 24;

const clampLimit = (n: number | undefined) =>
  Math.min(Math.max(1, Math.trunc(n ?? DEFAULT_LIMIT) || DEFAULT_LIMIT), MAX_LIMIT);

/**
 * Resolves a rail's configured source into real products.
 *
 * Every branch degrades to an empty array rather than throwing: a rail
 * pointing at a category the owner later deleted should quietly render
 * nothing (and the section hides itself), never break the homepage.
 */
export async function resolveRailProducts(source: ProductRailSource | undefined): Promise<Product[]> {
  if (!source) return [];

  try {
    switch (source.type) {
      case "newest":
        return await getNewArrivals(clampLimit(source.limit));

      case "featured":
        return await getFeaturedProducts(clampLimit(source.limit));

      case "sale": {
        // No dedicated "on sale" query exists — compareAtPrice is derived per
        // product in the mapping layer, not a filterable column. Filtering a
        // featured page here is honest and cheap at this catalogue size; it
        // becomes a real WHERE clause if the catalogue grows.
        const limit = clampLimit(source.limit);
        const { products } = await getFeaturedProductsPaged({ limit: MAX_LIMIT * 2 });
        return products.filter((p) => p.compareAtPrice).slice(0, limit);
      }

      case "category": {
        if (!source.categorySlug) return [];
        const { products } = await getProductsByCategoryHandle(source.categorySlug, {
          limit: clampLimit(source.limit),
        });
        return products;
      }

      case "collection": {
        if (!source.collectionSlug) return [];
        const { products } = await getProductsByCollectionHandle(source.collectionSlug, {
          limit: clampLimit(source.limit),
        });
        return products;
      }

      case "manual":
        // getProductsByHandles preserves the requested order, which is the
        // whole point of a manual rail — the owner arranged them.
        return source.productSlugs?.length
          ? await getProductsByHandles(source.productSlugs.slice(0, MAX_LIMIT))
          : [];
    }
  } catch {
    return [];
  }
}

/**
 * Consecutive hero sections merge into one carousel — the behaviour the
 * homepage already had, preserved now that heroes are ordinary sections in
 * a global order. Two heroes next to each other are a swipeable pair; a
 * hero, then a rail, then another hero are three separate sections.
 */
export function groupSections(sections: HomepageSection[]): HomepageSection[][] {
  const groups: HomepageSection[][] = [];
  for (const section of sections) {
    const last = groups[groups.length - 1];
    if (section.kind === "hero" && last?.[0]?.kind === "hero") {
      last.push(section);
    } else {
      groups.push([section]);
    }
  }
  return groups;
}
