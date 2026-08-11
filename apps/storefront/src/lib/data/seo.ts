import { medusaFetch } from "@/lib/medusa";

// Mirrors apps/backend's src/modules/seo model exactly — one shared shape
// across product/category/homepage since the admin-editable field set is
// identical for all three (see PROJECT_MEMORY.md's "Admin-first platform,
// Phase A" entry for why a single polymorphic module was chosen over a
// Module Link per entity type: homepage has no underlying Medusa entity to
// link against, so a generic resource_type/resource_id row is the one
// design that covers all three without duplicating the model).
export type SeoResourceType = "product" | "category" | "homepage";

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

type MedusaSeo = {
  seo_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  social_image_url: string | null;
  keywords: string | null;
  robots: "index" | "noindex";
  structured_data_override: Record<string, unknown> | null;
};

function toDomainSeo(s: MedusaSeo): SeoOverride {
  return {
    seoTitle: s.seo_title,
    metaDescription: s.meta_description,
    canonicalUrl: s.canonical_url,
    ogTitle: s.og_title,
    ogDescription: s.og_description,
    socialImageUrl: s.social_image_url,
    keywords: s.keywords,
    robots: s.robots,
    structuredDataOverride: s.structured_data_override,
  };
}

// Never throws — a missing/unreachable SEO record must never break the page
// it's decorating. Falls back to null, same as every other "admin left this
// empty" case in this codebase (see PRODUCT_CARD_WISHLIST_PDP_SPEC.md's
// Characteristics section for the same pattern).
export async function getSeoOverride(
  resourceType: SeoResourceType,
  resourceId: string
): Promise<SeoOverride | null> {
  try {
    const params = new URLSearchParams({ resource_type: resourceType, resource_id: resourceId });
    const { seo } = await medusaFetch<{ seo: MedusaSeo | null }>(`/store/seo?${params.toString()}`, {
      next: { revalidate: 30 },
    });
    return seo ? toDomainSeo(seo) : null;
  } catch {
    return null;
  }
}
