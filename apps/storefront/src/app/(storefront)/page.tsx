import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { ProductRail } from "@/components/home/ProductRail";
import { EditorialBanner } from "@/components/home/EditorialBanner";
import { TrustStrip } from "@/components/home/TrustStrip";
import { Newsletter } from "@/components/home/Newsletter";
import { getNavCategories } from "@/lib/data/categories";
import { getHomepageBlocks } from "@/lib/data/homepage-blocks";
import { getFeaturedProducts, getNewArrivals } from "@/lib/data/products";
import { getSeoOverride } from "@/lib/data/seo";
import { siteDefaultDescription, siteDefaultTitle, siteUrl } from "@/lib/site-config";

// Admin-editable SEO overrides (Admin-first platform, Phase B) — same
// resource_id: "homepage" singleton pattern as the admin route, falling
// back to RootLayout's own defaults when nothing's been entered.
export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoOverride("homepage", "homepage");
  const title = seo?.seoTitle || siteDefaultTitle;
  const description = seo?.metaDescription || siteDefaultDescription;

  return {
    // Always absolute. The root layout's "%s | STIA" template is right for
    // inner pages but wrong here: the homepage title already carries the
    // brand, so letting the template apply produced
    // "STIA — Είδη Σπιτιού… | STIA". Only the admin-set title was absolute
    // before, so the double-brand appeared whenever the SEO field was empty —
    // which is its default state.
    title: { absolute: title },
    description,
    alternates: { canonical: seo?.canonicalUrl || "/" },
    ...(seo?.robots === "noindex" ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      url: siteUrl,
      ...(seo?.socialImageUrl ? { images: [{ url: seo.socialImageUrl }] } : {}),
    },
    ...(seo?.keywords ? { keywords: seo.keywords } : {}),
  };
}

export default async function HomePage() {
  const [categories, featured, newArrivals, heroSlides, promoBlocks] = await Promise.all([
    getNavCategories(),
    getFeaturedProducts(12),
    getNewArrivals(12),
    getHomepageBlocks("hero"),
    getHomepageBlocks("promo"),
  ]);

  return (
    <>
      <Hero slides={heroSlides} />
      <CategoryGrid categories={categories} />
      <ProductRail title="Προτεινόμενα" viewAllHref="/protainomena" products={featured} />
      <EditorialBanner blocks={promoBlocks} />
      <ProductRail title="Νέες αφίξεις" viewAllHref="/nea-afiksi" products={newArrivals} />
      <TrustStrip />
      <Newsletter />
    </>
  );
}
