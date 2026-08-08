import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // `/anazitisi` is deliberately absent: it carries a `noindex` meta
        // tag instead, and a robots.txt block would stop crawlers reaching
        // the page at all — meaning they'd never see the noindex.
        disallow: ["/kalathi", "/checkout", "/logariasmos", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
