/**
 * Content/CMS domain types and pure helpers.
 *
 * Deliberately dependency-free and CLIENT-SAFE: no database import, no
 * `server-only`. Client Components (ConsentBanner, AnalyticsScripts,
 * HeroCarousel, PromoBannerBar) need these shapes and one pure predicate, and
 * must be able to import them without dragging the Postgres driver into the
 * browser bundle.
 *
 * That is not hypothetical — it happened. When these types briefly lived
 * alongside the queries in lib/db/content.ts, ConsentBanner's *value* import
 * of hasAnyAnalyticsService pulled `postgres` (and its net/tls/fs imports)
 * into the client graph. `server-only` turned what would have been a
 * confusing bundling failure into an immediate, explicit build error.
 *
 * Rule this file encodes: types and pure functions here, queries in
 * lib/db/content.ts, and the two never merge.
 */

export type SiteSettings = {
  footerTagline: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
  businessHours: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  announcementText: string | null;
  cartMessage: string | null;
};

export type PromoBanner = {
  headline: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  endsAt: string | null;
};

export type AnalyticsSettings = {
  ga4MeasurementId: string | null;
  gtmContainerId: string | null;
  metaPixelId: string | null;
  clarityProjectId: string | null;
};

export type HomepageBlock = {
  id: string;
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
};

export type ContentPage = { title: string; body: string | null };

export type SeoResourceType = "product" | "category" | "collection" | "page" | "homepage";

export type SeoOverride = {
  seoTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  socialImageUrl: string | null;
  keywords: string | null;
  robots: "index" | "noindex";
  structuredDataOverride: Record<string, unknown> | null;
};

export type ProductExtra = {
  badgeLabel: string | null;
  badgeTone: "accent" | "success" | "neutral";
  warrantyText: string | null;
  downloadsUrl: string | null;
};

/**
 * Drives whether the consent banner appears at all: no configured analytics
 * service means there is nothing to consent to, so no banner is shown.
 * Pure — safe to call from a Client Component.
 */
export function hasAnyAnalyticsService(settings: AnalyticsSettings | null): boolean {
  if (!settings) return false;
  return Boolean(
    settings.ga4MeasurementId || settings.gtmContainerId || settings.metaPixelId || settings.clarityProjectId
  );
}
