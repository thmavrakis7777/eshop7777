import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPageView } from "@/components/content/ContentPageView";
import { getContentPage } from "@/lib/data/content-pages";
import { getSeoOverride } from "@/lib/data/seo";
import { deriveMetaDescription } from "@/lib/seo-text";
import { richBodyToPlainText } from "@/components/content/RichBody";
import { siteUrl } from "@/lib/site-config";

const SLUG = "epistrofes";
const PATH = "/epistrofes";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getContentPage(SLUG);
  if (!page) return {};

  const seo = await getSeoOverride("page", page.id);
  const title = seo?.seoTitle || page.title;
  const description = seo?.metaDescription || deriveMetaDescription(richBodyToPlainText(page.body));
  const path = seo?.canonicalUrl || PATH;

  return {
    title: seo?.seoTitle ? { absolute: seo.seoTitle } : title,
    description,
    alternates: { canonical: path },
    ...(seo?.robots === "noindex" ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      url: `${siteUrl}${path}`,
      ...(seo?.socialImageUrl ? { images: [{ url: seo.socialImageUrl }] } : {}),
    },
    ...(seo?.keywords ? { keywords: seo.keywords } : {}),
  };
}

export default async function ReturnsPage() {
  const page = await getContentPage(SLUG);
  if (!page) notFound();

  return <ContentPageView page={page} />;
}
