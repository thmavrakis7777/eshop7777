import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPageView } from "@/components/content/ContentPageView";
import { getContentPage } from "@/lib/data/content-pages";
import { siteUrl } from "@/lib/site-config";

const SLUG = "oroi-xrisis";
const PATH = "/oroi-xrisis";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getContentPage(SLUG);
  if (!page) return {};

  return {
    title: page.title,
    alternates: { canonical: PATH },
    openGraph: { title: page.title, url: `${siteUrl}${PATH}` },
  };
}

export default async function TermsPage() {
  const page = await getContentPage(SLUG);
  if (!page) notFound();

  return <ContentPageView page={page} />;
}
