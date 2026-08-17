import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db/client";
import { publicImageUrl } from "@/lib/storage/urls";
import type {
  AnalyticsSettings,
  ContentPage,
  HomepageBlock,
  HomepageSection,
  HomepageSectionConfig,
  HomepageSectionKind,
  ProductExtra,
  PromoBanner,
  SeoOverride,
  SeoResourceType,
  SiteSettings,
} from "@/lib/content-types";

/**
 * Storefront content (CMS), SEO overrides and site settings — the tables
 * that replace seven custom Medusa modules.
 *
 * Caching: these render on every page (RootLayout reads settings + promo
 * banner on each request), so they keep the same revalidate windows the
 * Medusa `fetch` calls used to declare. `unstable_cache` is the deliberate
 * choice over Next 16's `use cache` directive: the latter requires enabling
 * `cacheComponents` app-wide, which changes the caching model for every
 * route at once. That is a decision for the performance phase, made on its
 * own merits and verified — not something to slip into a data-layer swap.
 *
 * Every function keeps the never-throw contract of the code it replaces: a
 * missing or unreadable content row must never break the page it decorates.
 * Cache tags are already in place so Phase 10's admin writes can invalidate
 * precisely instead of waiting out a TTL.
 */

// Re-exported so existing `from "@/lib/db/content"` type imports keep working.
export type {
  AnalyticsSettings,
  ContentPage,
  HomepageBlock,
  HomepageSection,
  HomepageSectionConfig,
  HomepageSectionKind,
  ProductExtra,
  PromoBanner,
  SeoOverride,
  SeoResourceType,
  SiteSettings,
};

export const CACHE_TAGS = {
  siteSettings: "site-settings",
  promoBanner: "promo-banner",
  analytics: "analytics-settings",
  homepageBlocks: "homepage-blocks",
  contentPages: "content-pages",
  seo: "seo",
} as const;

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------

export const getSiteSettings = unstable_cache(
  async (): Promise<SiteSettings | null> => {
    try {
      const rows = await sql<
        {
          footer_tagline: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          contact_address: string | null;
          business_hours: string | null;
          facebook_url: string | null;
          instagram_url: string | null;
          tiktok_url: string | null;
          announcement_text: string | null;
          cart_message: string | null;
          store_name: string | null;
          logo_path: string | null;
          favicon_path: string | null;
          og_image_path: string | null;
          default_seo_title: string | null;
          default_seo_description: string | null;
        }[]
      >`SELECT footer_tagline, contact_phone, contact_email, contact_address,
               business_hours, facebook_url, instagram_url, tiktok_url,
               announcement_text, cart_message,
               store_name, logo_path, favicon_path, og_image_path,
               default_seo_title, default_seo_description
          FROM shop.site_setting LIMIT 1`;
      const s = rows[0];
      if (!s) return null;
      return {
        storeName: s.store_name,
        logoUrl: publicImageUrl(s.logo_path),
        faviconUrl: publicImageUrl(s.favicon_path),
        ogImageUrl: publicImageUrl(s.og_image_path),
        defaultSeoTitle: s.default_seo_title,
        defaultSeoDescription: s.default_seo_description,
        footerTagline: s.footer_tagline,
        contactPhone: s.contact_phone,
        contactEmail: s.contact_email,
        contactAddress: s.contact_address,
        businessHours: s.business_hours,
        facebookUrl: s.facebook_url,
        instagramUrl: s.instagram_url,
        tiktokUrl: s.tiktok_url,
        announcementText: s.announcement_text,
        cartMessage: s.cart_message,
      };
    } catch {
      return null;
    }
  },
  ["site-settings"],
  { revalidate: 60, tags: [CACHE_TAGS.siteSettings] }
);

// ---------------------------------------------------------------------------
// Promo banner
// ---------------------------------------------------------------------------

/**
 * The publish/expiry gate now lives in the WHERE clause. Previously the
 * Medusa route applied it server-side and the storefront trusted whatever
 * came back; the rule is the same, it is just visible here now.
 */
export const getPromoBanner = unstable_cache(
  async (): Promise<PromoBanner | null> => {
    try {
      const rows = await sql<
        {
          headline: string | null;
          body: string | null;
          cta_label: string | null;
          cta_href: string | null;
          ends_at: Date | null;
        }[]
      >`SELECT headline, body, cta_label, cta_href, ends_at
          FROM shop.promo_banner
         WHERE is_published AND (ends_at IS NULL OR ends_at > now())
         LIMIT 1`;
      const b = rows[0];
      if (!b) return null;
      return {
        headline: b.headline,
        body: b.body,
        ctaLabel: b.cta_label,
        ctaHref: b.cta_href,
        endsAt: b.ends_at ? new Date(b.ends_at).toISOString() : null,
      };
    } catch {
      return null;
    }
  },
  ["promo-banner"],
  { revalidate: 30, tags: [CACHE_TAGS.promoBanner] }
);

// ---------------------------------------------------------------------------
// Analytics settings
// ---------------------------------------------------------------------------

export const getAnalyticsSettings = unstable_cache(
  async (): Promise<AnalyticsSettings | null> => {
    try {
      const rows = await sql<
        {
          ga4_measurement_id: string | null;
          gtm_container_id: string | null;
          meta_pixel_id: string | null;
          clarity_project_id: string | null;
        }[]
      >`SELECT ga4_measurement_id, gtm_container_id, meta_pixel_id, clarity_project_id
          FROM shop.analytics_setting LIMIT 1`;
      const s = rows[0];
      if (!s) return null;
      return {
        ga4MeasurementId: s.ga4_measurement_id,
        gtmContainerId: s.gtm_container_id,
        metaPixelId: s.meta_pixel_id,
        clarityProjectId: s.clarity_project_id,
      };
    } catch {
      return null;
    }
  },
  ["analytics-settings"],
  { revalidate: 30, tags: [CACHE_TAGS.analytics] }
);

// ---------------------------------------------------------------------------
// Homepage blocks
// ---------------------------------------------------------------------------

type HomepageSectionRow = {
  id: string;
  kind: HomepageSectionKind;
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_path: string | null;
  mobile_image_path: string | null;
  image_alt: string | null;
  config: HomepageSectionConfig | null;
};

const SECTION_FIELDS = sql`
  id, kind, eyebrow, heading, body, cta_label, cta_href,
  image_path, mobile_image_path, image_alt, config`;

function toSection(b: HomepageSectionRow): HomepageSection {
  return {
    id: b.id,
    kind: b.kind,
    eyebrow: b.eyebrow,
    heading: b.heading,
    body: b.body,
    ctaLabel: b.cta_label,
    ctaHref: b.cta_href,
    imageUrl: publicImageUrl(b.image_path),
    mobileImageUrl: publicImageUrl(b.mobile_image_path),
    imageAlt: b.image_alt,
    // NOT NULL DEFAULT '{}' in the schema, but a hand-edited row could still
    // be null — the homepage must never 500 over a settings row.
    config: b.config ?? {},
  };
}

/**
 * Every published homepage section, in the order the owner arranged them.
 *
 * One query for the whole page rather than one per section type: the
 * homepage is a single ordered list now, and the previous per-kind reads
 * couldn't express "category grid above the sale rail" at all.
 */
export const getHomepageSections = unstable_cache(
  async (): Promise<HomepageSection[]> => {
    try {
      const rows = await sql<HomepageSectionRow[]>`
        SELECT ${SECTION_FIELDS}
          FROM shop.homepage_block
         WHERE is_published
         ORDER BY sort_order, created_at`;
      return rows.map(toSection);
    } catch {
      return [];
    }
  },
  ["homepage-sections"],
  { revalidate: 60, tags: [CACHE_TAGS.homepageBlocks] }
);

// ---------------------------------------------------------------------------
// Content pages
// ---------------------------------------------------------------------------

export const getContentPage = unstable_cache(
  async (slug: string): Promise<ContentPage | null> => {
    try {
      const rows = await sql<{ id: string; title: string; body: string | null }[]>`
        SELECT id, title, body FROM shop.content_page
         WHERE slug = ${slug} AND is_published LIMIT 1`;
      return rows[0] ? { id: rows[0].id, title: rows[0].title, body: rows[0].body } : null;
    } catch {
      return null;
    }
  },
  ["content-page"],
  { revalidate: 60, tags: [CACHE_TAGS.contentPages] }
);

// ---------------------------------------------------------------------------
// SEO overrides
// ---------------------------------------------------------------------------

export const getSeoOverride = unstable_cache(
  async (resourceType: SeoResourceType, resourceId: string): Promise<SeoOverride | null> => {
    try {
      const rows = await sql<
        {
          seo_title: string | null;
          meta_description: string | null;
          canonical_url: string | null;
          og_title: string | null;
          og_description: string | null;
          social_image_path: string | null;
          keywords: string | null;
          robots: "index" | "noindex";
          structured_data_override: Record<string, unknown> | null;
        }[]
      >`SELECT seo_title, meta_description, canonical_url, og_title, og_description,
               social_image_path, keywords, robots, structured_data_override
          FROM shop.seo_meta
         WHERE resource_type = ${resourceType} AND resource_id = ${resourceId}
         LIMIT 1`;
      const s = rows[0];
      if (!s) return null;
      return {
        seoTitle: s.seo_title,
        metaDescription: s.meta_description,
        canonicalUrl: s.canonical_url,
        ogTitle: s.og_title,
        ogDescription: s.og_description,
        socialImageUrl: publicImageUrl(s.social_image_path),
        keywords: s.keywords,
        robots: s.robots,
        structuredDataOverride: s.structured_data_override,
      };
    } catch {
      return null;
    }
  },
  ["seo-override"],
  { revalidate: 30, tags: [CACHE_TAGS.seo] }
);

// ---------------------------------------------------------------------------
// Product merchandising extras
//
// These were a separate `product_extra` table keyed by product id in Medusa,
// because Medusa's Product model had nowhere to put them. They are now plain
// columns on shop.product — so this is a projection of a row we often already
// have, not a second lookup against a side table.
// ---------------------------------------------------------------------------

export async function getProductExtra(productId: string): Promise<ProductExtra | null> {
  try {
    const rows = await sql<
      {
        badge_label: string | null;
        badge_tone: "accent" | "success" | "neutral";
        warranty_text: string | null;
        downloads_url: string | null;
      }[]
    >`SELECT badge_label, badge_tone, warranty_text, downloads_url
        FROM shop.product WHERE id = ${productId} LIMIT 1`;
    const e = rows[0];
    if (!e) return null;
    // Nothing merchandised for this product — null, so the PDP renders no
    // empty badge/warranty section rather than an empty shell.
    if (!e.badge_label && !e.warranty_text && !e.downloads_url) return null;
    return {
      badgeLabel: e.badge_label,
      badgeTone: e.badge_tone ?? "neutral",
      warrantyText: e.warranty_text,
      downloadsUrl: e.downloads_url,
    };
  } catch {
    return null;
  }
}
