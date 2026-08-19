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
  // Header "Phone Orders" line. The number itself is contactPhone — one
  // number for the whole site, shown in two places.
  phoneOrdersEnabled: boolean;
  phoneOrdersLabel: string | null;
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
export type HomepageSectionKind =
  | "hero"
  | "promo"
  | "category_grid"
  | "product_rail"
  | "content"
  // Fixed-content sections: positionable and hideable from the admin, but
  // their copy stays curated in code — see migration 0005 for why.
  | "trust"
  | "newsletter";

/**
 * Icons available to a guarantee tile. A fixed set rather than free input:
 * these render as inline SVG, so accepting arbitrary markup would be an XSS
 * hole, and arbitrary image URLs would break the strip's visual rhythm.
 */
export type TrustIconName =
  | "truck"
  | "returns"
  | "payment"
  | "support"
  | "shield"
  | "phone"
  | "gift"
  | "leaf";

export type TrustItem = {
  icon: TrustIconName;
  title: string;
  description: string;
  visible: boolean;
};

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
  /** trust: the guarantee tiles, in order. Absent = the built-in defaults. */
  items?: TrustItem[];
};

export type HomepageSection = HomepageBlock & {
  kind: HomepageSectionKind;
  config: HomepageSectionConfig;
};

export type ContentPage = { id: string; title: string; body: string | null };

// Mirrors the CHECK constraint on shop.seo_meta.resource_type — widened by
// migration 0011 so Journal articles store their SEO in the one polymorphic
// table every other resource already uses, rather than growing a second set
// of SEO columns on shop.journal_article.
export type SeoResourceType =
  | "product"
  | "category"
  | "collection"
  | "page"
  | "homepage"
  | "journal_article";

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

// The two real consent categories this store's cookie banner offers — see
// consent-storage.ts's long comment on why there's no third "Preferences"
// category. GA4/GTM/Clarity are analytics; Meta Pixel is marketing (it
// exists to measure/target ads). If a future service belongs to neither
// bucket cleanly, that's the trigger to reconsider the category split, not
// to force it into one of these two.
export function hasAnalyticsService(settings: AnalyticsSettings | null): boolean {
  if (!settings) return false;
  return Boolean(settings.ga4MeasurementId || settings.gtmContainerId || settings.clarityProjectId);
}

export function hasMarketingService(settings: AnalyticsSettings | null): boolean {
  if (!settings) return false;
  return Boolean(settings.metaPixelId);
}
