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
  // Branding. `storeName` is the one every visible brand mention reads —
  // header/footer/mobile-menu logos, <title> template, JSON-LD, emails —
  // so changing it in the admin renames the whole storefront. Falls back to
  // lib/site-config.ts's build-time constant only when unset/unreadable.
  storeName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  defaultSeoTitle: string | null;
  defaultSeoDescription: string | null;
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
  mobileImageUrl: string | null;
  imageAlt: string | null;
};

/**
 * The homepage's section types. Adding one costs a member here, a case in
 * the storefront renderer and a case in the admin form — deliberately not a
 * migration, which is why per-kind settings live in a `config` jsonb rather
 * than in their own columns (see migration 0004).
 */
export type HomepageSectionKind = "hero" | "promo" | "category_grid" | "product_rail" | "content";

/** Where a product rail gets its products. */
export type ProductRailSource =
  | { type: "newest"; limit: number }
  | { type: "featured"; limit: number }
  | { type: "sale"; limit: number }
  | { type: "category"; categorySlug: string; limit: number }
  | { type: "collection"; collectionSlug: string; limit: number }
  // Exact products, in the order the owner arranged them — the "Summer
  // Essentials, and I pick precisely these" case.
  | { type: "manual"; productSlugs: string[] };

export type HomepageSectionConfig = {
  /** category_grid: which categories, in which order. Empty = every top-level category, nav order. */
  categorySlugs?: string[];
  /** product_rail: where its products come from. */
  source?: ProductRailSource;
  /** product_rail: optional "see all" destination shown beside the heading. */
  viewAllHref?: string | null;
  /** hero/promo/content: hide the CTA without losing its configured label/href. */
  showButton?: boolean;
};

export type HomepageSection = HomepageBlock & {
  kind: HomepageSectionKind;
  config: HomepageSectionConfig;
};

export type ContentPage = { id: string; title: string; body: string | null };

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
