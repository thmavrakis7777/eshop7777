import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = "https://www.stia.gr";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/kalathi", "/logariasmos", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
