import type { MetadataRoute } from "next";
import { getNavCategories } from "@/lib/data/categories";
import { getContentPage } from "@/lib/data/content-pages";
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
  { url: `${siteUrl}/protainomena`, changeFrequency: "weekly", priority: 0.7 },
];

// Enumerates the full catalog directly (fine at today's scale). Once the
// catalog grows past a few thousand SKUs, split into paginated sitemap
// files (Next supports generateSitemaps) to stay under the 50k-URL limit.
//
// `next build` runs this function at build time (every other page is
// request-time rendered) — an unreachable database must degrade to the
// always-available static routes instead of failing the whole production
// build.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let navCategories: Awaited<ReturnType<typeof getNavCategories>>;
  let productHandles: Awaited<ReturnType<typeof getAllProductHandles>>;
  let collectionHandles: Awaited<ReturnType<typeof getAllCollectionHandles>>;
  let contentPages: { slug: (typeof CONTENT_PAGE_SLUGS)[number]; page: unknown }[];
  try {
    [navCategories, productHandles, collectionHandles, contentPages] = await Promise.all([
      getNavCategories(),
      getAllProductHandles(),
      getAllCollectionHandles(),
      Promise.all(CONTENT_PAGE_SLUGS.map(async (slug) => ({ slug, page: await getContentPage(slug) }))),
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
  const categoryRoutes: MetadataRoute.Sitemap = [];
  const walk = (nodes: CategoryNode[], prefix: string, depth: number) => {
    for (const node of nodes) {
      const url = `${prefix}/${node.handle}`;
      categoryRoutes.push({
        url: `${siteUrl}${url}`,
        changeFrequency: "weekly",
        priority: Math.max(0.9 - depth * 0.2, 0.5),
      });
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

  return [...staticRoutes, ...categoryRoutes, ...collectionRoutes, ...productRoutes];
}
