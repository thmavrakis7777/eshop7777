import { getHomepageSections } from "@/lib/db/content";
import { getBestSellingProductSlugs } from "@/lib/db/catalog";
import {
  getFeaturedProducts,
  getNewArrivals,
  getNewArrivalsPaged,
  getProductsByCategoryHandle,
  getProductsByCollectionHandle,
  getProductsByHandles,
  getSaleProductsPaged,
} from "@/lib/data/products";
import { getCollectionByHandle } from "@/lib/data/collections";
import type { HomepageSection, ProductRailSource, ShowcaseSource } from "@/lib/content-types";
import type { CategoryNode, NavCategory, Product } from "@/lib/types";

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
        // The same query /prosfores and the showcase's "sale" source use, so
        // the rail can never disagree with the offers page. It used to filter
        // the first 48 products A→Z by compareAtPrice in JS, which silently
        // dropped every sale product past the 48th title, and judged "on
        // sale" by the first variant only, where SALE_PREDICATE counts any
        // active variant.
        const { products } = await getSaleProductsPaged({ limit: clampLimit(source.limit) });
        return products;
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

      case "best_sellers": {
        const slugs = await getBestSellingProductSlugs(clampLimit(source.limit));
        if (slugs.length > 0) return await getProductsByHandles(slugs);
        // Not enough real sales yet (a new store, or simply no completed
        // orders today) — fall back to the owner's manually curated list
        // rather than an error or a fabricated ranking. No fallback
        // configured either => empty array => RailSection already renders
        // nothing for an empty rail, exactly like a deleted category would.
        return source.fallbackProductSlugs?.length
          ? await getProductsByHandles(source.fallbackProductSlugs.slice(0, MAX_LIMIT))
          : [];
      }
    }
  } catch (err) {
    // A rail that can't resolve must not break the homepage, but swallowing
    // the reason silently makes a misconfigured section indistinguishable
    // from an empty one — log it so it's diagnosable.
    console.error(`[homepage] rail source "${source.type}" failed to resolve:`, err);
    return [];
  }
}

/** Everything an Editorial Showcase needs from its source besides its own copy. */
export type ShowcaseData = {
  products: Product[];
  // How many products the source holds in total — for the "see all N" link.
  // null where there's no listing page to send anyone to (best sellers,
  // hand-picked), so no count is ever shown for those.
  total: number | null;
  // The source's own listing page, or null when it has none.
  href: string | null;
  // The source's name (the category's, the collection's, "Προσφορές"…) — the
  // eyebrow when the owner leaves theirs blank. null for hand-picked.
  label: string | null;
  // The category's or collection's own image path — the Spread layout's
  // large image when the owner hasn't uploaded one for the section.
  imagePath: string | null;
};

const EMPTY_SHOWCASE: ShowcaseData = { products: [], total: null, href: null, label: null, imagePath: null };

// The nav tree is roots with nested children; the admin picker offers main
// categories only, but a slug saved from a deeper level must still resolve.
function findCategory(nodes: CategoryNode[], slug: string): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.handle === slug) return node;
    const found = findCategory(node.children, slug);
    if (found) return found;
  }
  return undefined;
}

/**
 * Resolves an Editorial Showcase's source into real products, plus the
 * facts around them the section shows: the real total and the real listing
 * page, never a guessed count.
 *
 * Same degrade-to-empty contract as resolveRailProducts: a category that was
 * deleted or deactivated, or a failing query, gives zero products and the
 * section hides itself — the homepage never breaks over one section.
 *
 * `categories` is the nav tree the homepage already loaded (getNavCategories,
 * cached), so a category source costs no extra lookup: it already carries
 * the canonical URL, the name and the image.
 */
export async function resolveShowcase(
  source: ShowcaseSource | undefined,
  limit: number,
  categories: NavCategory[]
): Promise<ShowcaseData> {
  if (!source) return EMPTY_SHOWCASE;

  try {
    switch (source.type) {
      case "category": {
        const category = findCategory(categories, source.categorySlug.trim().replace(/^\/+/, ""));
        // Inactive and deleted categories aren't in the nav tree — the
        // listing page would 404, so the section must not link to it.
        if (!category) return EMPTY_SHOWCASE;
        const { products, count } = await getProductsByCategoryHandle(category.handle, { limit });
        return {
          products,
          total: count,
          href: category.canonicalHref,
          label: category.name,
          imagePath: category.imagePath ?? null,
        };
      }

      case "collection": {
        const collection = await getCollectionByHandle(source.collectionSlug);
        if (!collection) return EMPTY_SHOWCASE;
        const { products, count } = await getProductsByCollectionHandle(collection.slug, { limit });
        return {
          products,
          total: count,
          href: `/syllogi/${collection.slug}`,
          label: collection.title,
          imagePath: collection.imagePath,
        };
      }

      case "sale": {
        // The real "on sale" query (the one /prosfores lists), with its true
        // total for the "see all N" link.
        const { products, count } = await getSaleProductsPaged({ limit });
        return { products, total: count, href: "/prosfores", label: "Προσφορές", imagePath: null };
      }

      case "newest": {
        const { products, count } = await getNewArrivalsPaged({ limit });
        return { products, total: count, href: "/nea-afiksi", label: "Νέες αφίξεις", imagePath: null };
      }

      case "best_sellers": {
        // Same fallback rule as the rail: real sales ranking first; the
        // owner's own picks only while there are no sales to rank.
        const slugs = await getBestSellingProductSlugs(limit);
        const products =
          slugs.length > 0
            ? await getProductsByHandles(slugs)
            : source.fallbackProductSlugs?.length
              ? await getProductsByHandles(source.fallbackProductSlugs.slice(0, limit))
              : [];
        return { products, total: null, href: null, label: "Best Sellers", imagePath: null };
      }

      case "manual": {
        const products = source.productSlugs?.length
          ? await getProductsByHandles(source.productSlugs.slice(0, limit))
          : [];
        return { products, total: null, href: null, label: null, imagePath: null };
      }
    }
  } catch (err) {
    console.error(`[homepage] showcase source "${source.type}" failed to resolve:`, err);
    return EMPTY_SHOWCASE;
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
