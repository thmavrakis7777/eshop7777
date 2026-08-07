import type { MetadataRoute } from "next";
import { getNavCategories } from "@/lib/data/categories";
import { getAllProductHandles } from "@/lib/data/products";
import { siteUrl } from "@/lib/site-config";

// Enumerates the full catalog directly (fine at today's scale). Once the
// catalog grows past a few thousand SKUs, split into paginated sitemap
// files (Next supports generateSitemaps) to stay under the 50k-URL limit.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [navCategories, productHandles] = await Promise.all([
    getNavCategories(),
    getAllProductHandles(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [{ url: siteUrl, changeFrequency: "daily", priority: 1 }];

  const categoryRoutes: MetadataRoute.Sitemap = navCategories.flatMap((top) => [
    { url: `${siteUrl}/${top.handle}`, changeFrequency: "weekly", priority: 0.9 },
    ...top.children.map((child) => ({
      url: `${siteUrl}/${top.handle}/${child.handle}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ]);

  const productRoutes: MetadataRoute.Sitemap = productHandles.map((p) => ({
    url: `${siteUrl}/proionta/${p.handle}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
