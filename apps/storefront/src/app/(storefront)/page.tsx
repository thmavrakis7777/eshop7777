import type { Metadata } from "next";
import { Suspense } from "react";
import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { ProductRail } from "@/components/home/ProductRail";
import { ProductRailSkeleton } from "@/components/home/ProductRailSkeleton";
import { EditorialBanner } from "@/components/home/EditorialBanner";
import { TrustStrip } from "@/components/home/TrustStrip";
import { Newsletter } from "@/components/home/Newsletter";
import { getNavCategories } from "@/lib/data/categories";
import { getHomepageBlocks } from "@/lib/data/homepage-blocks";
import { getFeaturedProducts, getNewArrivals } from "@/lib/data/products";
import { getSeoOverride } from "@/lib/data/seo";
import { getBranding } from "@/lib/data/branding";
import { siteUrl } from "@/lib/site-config";

// Admin-editable SEO overrides (Admin-first platform, Phase B) — same
// resource_id: "homepage" singleton pattern as the admin route, falling
// back to RootLayout's own defaults when nothing's been entered.
export async function generateMetadata(): Promise<Metadata> {
  const [seo, branding] = await Promise.all([
    getSeoOverride("homepage", "homepage"),
    getBranding(),
  ]);
  const title = seo?.seoTitle || branding.defaultSeoTitle;
  const description = seo?.metaDescription || branding.defaultSeoDescription;

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

// Below-the-fold and mutually independent — each streams in on its own
// once its own query resolves, instead of the whole page (including the
// above-the-fold Hero/CategoryGrid) blocking on the slowest of the three.
async function FeaturedRail() {
  const featured = await getFeaturedProducts(12);
  return <ProductRail title="Προτεινόμενα" viewAllHref="/protainomena" products={featured} />;
}

async function NewArrivalsRail() {
  const newArrivals = await getNewArrivals(12);
  return <ProductRail title="Νέες αφίξεις" viewAllHref="/nea-afiksi" products={newArrivals} />;
}

async function PromoBanner() {
  const promoBlocks = await getHomepageBlocks("promo");
  return <EditorialBanner blocks={promoBlocks} />;
}

export default async function HomePage() {
  const [categories, heroSlides, branding] = await Promise.all([
    getNavCategories(),
    getHomepageBlocks("hero"),
    getBranding(),
  ]);

  return (
    <>
      <Hero slides={heroSlides} storeName={branding.storeName} />
      <CategoryGrid categories={categories} />
      <Suspense fallback={<ProductRailSkeleton title="Προτεινόμενα" />}>
        <FeaturedRail />
      </Suspense>
      <Suspense fallback={null}>
        <PromoBanner />
      </Suspense>
      <Suspense fallback={<ProductRailSkeleton title="Νέες αφίξεις" />}>
        <NewArrivalsRail />
      </Suspense>
      <TrustStrip />
      <Newsletter />
    </>
  );
}
