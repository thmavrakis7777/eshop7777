import type { MetadataRoute } from "next";
import { categories, products } from "@/lib/mock-data";

const siteUrl = "https://www.stia.gr";

// Phase 1 stub: enumerates today's mock catalog. In Phase 2 this becomes a
// paginated fetch against Medusa so it keeps working past the 50k-URL-per-file limit.
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${siteUrl}/${c.parentHandle ? `${c.parentHandle}/${c.handle}` : c.handle}`,
    changeFrequency: "weekly",
    priority: c.parentHandle ? 0.7 : 0.9,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${siteUrl}/proionta/${p.handle}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
