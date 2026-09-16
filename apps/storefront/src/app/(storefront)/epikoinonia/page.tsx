import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPageView } from "@/components/content/ContentPageView";
import { getContentPage } from "@/lib/data/content-pages";
import { getSiteSettings } from "@/lib/data/site-settings";
import { googleMapsSearchUrl } from "@/lib/maps";
import { getSeoOverride } from "@/lib/data/seo";
import { deriveMetaDescription } from "@/lib/seo-text";
import { richBodyToPlainText } from "@/components/content/RichBody";
import { siteUrl } from "@/lib/site-config";

const SLUG = "epikoinonia";
const PATH = "/epikoinonia";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getContentPage(SLUG);
  if (!page) return {};

  const seo = await getSeoOverride("page", page.id);
  const title = seo?.seoTitle || page.title;
  const description = seo?.metaDescription || deriveMetaDescription(richBodyToPlainText(page.body));
  const path = seo?.canonicalUrl || PATH;
  const ogImage = seo?.socialImageUrl || page.imageUrl;

  return {
    title: seo?.seoTitle ? { absolute: seo.seoTitle } : title,
    description,
    alternates: { canonical: path },
    ...(seo?.robots === "noindex" ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      url: `${siteUrl}${path}`,
      ...(ogImage ? { images: [{ url: ogImage, alt: page.imageAlt ?? title }] } : {}),
    },
    ...(seo?.keywords ? { keywords: seo.keywords } : {}),
  };
}

export default async function ContactPage() {
  const [page, settings] = await Promise.all([getContentPage(SLUG), getSiteSettings()]);
  if (!page) notFound();

  // From the Settings address, so it follows an address change without anyone
  // editing this page's text.
  const mapsUrl = googleMapsSearchUrl(settings?.contactAddress);

  return (
    <ContentPageView page={page} path={PATH}>
      {mapsUrl && (
        <p className="mt-8 text-[1.0625rem] leading-[1.75] text-ink-muted">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 hover:no-underline"
          >
            Δείτε το κατάστημα στο Google Maps
          </a>
        </p>
      )}
    </ContentPageView>
  );
}
