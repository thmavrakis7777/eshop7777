import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { HomepageSectionGroup } from "@/components/home/HomepageSections";
import { TrustStrip } from "@/components/home/TrustStrip";
import { Newsletter } from "@/components/home/Newsletter";
import { ScrollReveal } from "@/components/home/ScrollReveal";
import { getNavCategories } from "@/lib/data/categories";
import { getHomepageSections, groupSections } from "@/lib/data/homepage-sections";
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

/**
 * The homepage is composed from admin-arranged sections, not a hardcoded
 * list. Every section's type, order, visibility and content comes from
 * shop.homepage_block — see components/home/HomepageSections.tsx for the
 * kind → UI mapping and lib/data/homepage-sections.ts for how a product
 * rail's configured source resolves to real products.
 *
 * The fallback matters: a store with no sections configured yet still gets
 * a real homepage (default hero + category grid) rather than a blank page,
 * which is what a fresh install and the current database both hit.
 */
export default async function HomePage() {
  const [categories, sections, branding] = await Promise.all([
    getNavCategories(),
    getHomepageSections(),
    getBranding(),
  ]);

  const groups = groupSections(sections);

  return (
    <>
      {groups.length > 0 ? (
        groups.map((group, index) => (
          <HomepageSectionGroup
            key={group[0].id}
            group={group}
            categories={categories}
            storeName={branding.storeName}
            isFirstGroup={index === 0}
          />
        ))
      ) : (
        <>
          <ScrollReveal>
            <Hero slides={[]} storeName={branding.storeName} isFirstSection />
          </ScrollReveal>
          <CategoryGrid categories={categories} />
          <TrustStrip />
          <Newsletter />
        </>
      )}
    </>
  );
}
