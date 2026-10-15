import type { MetadataRoute } from "next";
import { isEmptyListing } from "@/lib/category-visibility";
import { getCategoryLastModified, getNavCategories, getNoindexCategoryIds } from "@/lib/data/categories";
import { getContentPage } from "@/lib/data/content-pages";
import { getJournalSitemapEntries } from "@/lib/data/journal";
import { getAllCollectionHandles, getAllProductHandles } from "@/lib/data/products";
import { siteUrl } from "@/lib/site-config";
import type { CategoryNode } from "@/lib/types";

// Same fixed slug set as the storefront's literal route folders (Admin-
// first platform, Phase D) — each only makes it into the sitemap if it's
// actually published, since an unpublished page 404s and has no business
// being offered to crawlers.
const CONTENT_PAGE_SLUGS = [
  "sxetika",
  "apostoles",
  "epistrofes",
  "pliromes",
  "eggyisi",
  "aporrito",
  "oroi-xrisis",
  "faq",
  "paraggelia",
  "epikoinonia",
  "odigoi-agoron",
  "karieres",
  "cookies",
] as const;

const baseRoutes: MetadataRoute.Sitemap = [
  { url: siteUrl, changeFrequency: "daily", priority: 1 },
  { url: `${siteUrl}/nea-afiksi`, changeFrequency: "daily", priority: 0.8 },
  // Listed even though it can be empty: it is a permanent, linked
  // destination whose emptiness is temporary, and dropping it from the
  // sitemap on stock levels teaches crawlers the URL is unreliable.
  { url: `${siteUrl}/prosfores`, changeFrequency: "daily", priority: 0.8 },
  { url: `${siteUrl}/best-sellers`, changeFrequency: "weekly", priority: 0.7 },
  // The Journal landing page is a permanent, footer-linked destination and
  // stays listed even before the first article exists, for the same reason
  // /prosfores does — dropping a real URL from the sitemap on content levels
  // teaches crawlers the URL is unreliable.
  { url: `${siteUrl}/journal`, changeFrequency: "weekly", priority: 0.7 },
];

// Enumerates the full catalog directly (fine at today's scale). Once the
// catalog grows past a few thousand SKUs, split into paginated sitemap
// files (Next supports generateSitemaps) to stay under the 50k-URL limit.
//
// Built from the database on every request, so a product or category added,
// edited, hidden or deleted in the dashboard is in the next fetch, with its
// real lastmod. It used to be `revalidate = 3600` (ISR). The build listed it
// as revalidating every minute, yet production kept serving the build-time
// copy: on 2026-10-13 it still lacked a product added 3.7 days earlier, plus
// that product's newly non-empty category and the lastmod of every product
// edited since. Even the dashboard's revalidatePath("/", "layout") after a
// save didn't refresh it. Crawlers fetch it a few times a day, and each
// fetch is a handful of indexed queries, so caching saved nothing worth that
// risk.
//
// An unreachable database still degrades to the always-available static
// routes rather than an error page.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let navCategories: Awaited<ReturnType<typeof getNavCategories>>;
  let categoryLastModified: Awaited<ReturnType<typeof getCategoryLastModified>>;
  let noindexCategoryIds: Awaited<ReturnType<typeof getNoindexCategoryIds>>;
  let productHandles: Awaited<ReturnType<typeof getAllProductHandles>>;
  let collectionHandles: Awaited<ReturnType<typeof getAllCollectionHandles>>;
  let contentPages: { slug: (typeof CONTENT_PAGE_SLUGS)[number]; page: unknown }[];
  let journal: Awaited<ReturnType<typeof getJournalSitemapEntries>>;
  try {
    [navCategories, categoryLastModified, noindexCategoryIds, productHandles, collectionHandles, contentPages, journal] = await Promise.all([
      getNavCategories(),
      getCategoryLastModified(),
      getNoindexCategoryIds(),
      getAllProductHandles(),
      getAllCollectionHandles(),
      Promise.all(CONTENT_PAGE_SLUGS.map(async (slug) => ({ slug, page: await getContentPage(slug) }))),
      // Published (and already-due) articles only — the query applies the
      // same publishing gate the storefront serves, so a draft or a scheduled
      // article can never be offered to a crawler before it exists.
      getJournalSitemapEntries(),
    ]);
  } catch (error) {
    console.warn("sitemap: database unreachable, generating static-only sitemap.", error);
    return baseRoutes;
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    ...baseRoutes,
    ...contentPages
      .filter(({ page }) => page)
      .map(({ slug }) => ({ url: `${siteUrl}/${slug}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];

  // Walks the tree to whatever depth it actually has rather than to a fixed
  // two levels, which silently left every sub-subcategory out of the
  // sitemap. Priority tapers with depth: a main category is a more important
  // entry point than a leaf, but a leaf is still a real, indexable page.
  //
  // A category with no products in it or below it is left out — its page is
  // noindex until the first product arrives (isEmptyListing), and a sitemap
  // must only offer pages that may be indexed (Search Console reports a
  // listed noindex URL as an error). That is the difference from /prosfores
  // above, which stays indexable while empty. The same goes for a category
  // the owner set to noindex in its SEO editor, the other way
  // categoryMetadata makes a page noindex. The walk still descends into both;
  // their children are judged on their own, since the rule is per-category.
  //
  // lastModified is when the page's content last really changed
  // (getCategoryLastModified) — never the build or request time, which would
  // tell crawlers everything changed on every deployment.
  const categoryRoutes: MetadataRoute.Sitemap = [];
  const walk = (nodes: CategoryNode[], prefix: string, depth: number) => {
    for (const node of nodes) {
      const url = `${prefix}/${node.handle}`;
      if (!isEmptyListing(node) && !noindexCategoryIds.has(node.id)) {
        const lastModified = categoryLastModified.get(node.id);
        categoryRoutes.push({
          url: `${siteUrl}${url}`,
          ...(lastModified ? { lastModified } : {}),
          changeFrequency: "weekly",
          priority: Math.max(0.9 - depth * 0.2, 0.5),
        });
      }
      walk(node.children, url, depth + 1);
    }
  };
  walk(navCategories, "", 0);

  const collectionRoutes: MetadataRoute.Sitemap = collectionHandles.map((c) => ({
    url: `${siteUrl}/syllogi/${c.handle}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productRoutes: MetadataRoute.Sitemap = productHandles.map((p) => ({
    url: `${siteUrl}/proionta/${p.handle}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Articles rank above product pages here because an editorial guide is the
  // entry point a search visitor lands on first; category pages sit just
  // below the landing page, in line with the other content routes.
  const journalRoutes: MetadataRoute.Sitemap = [
    ...journal.categories.map((c) => ({
      url: `${siteUrl}/journal/kategoria/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...journal.articles.map((a) => ({
      url: `${siteUrl}/journal/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  return [...staticRoutes, ...categoryRoutes, ...collectionRoutes, ...productRoutes, ...journalRoutes];
}
