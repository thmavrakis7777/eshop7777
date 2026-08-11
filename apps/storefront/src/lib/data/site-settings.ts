import { medusaFetch } from "@/lib/medusa";

// Mirrors apps/backend's src/modules/site-settings model exactly. A true
// singleton — one row for the whole store, unlike the seo module's
// per-resource rows.
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
};

type MedusaSiteSettings = {
  footer_tagline: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  business_hours: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  announcement_text: string | null;
};

function toDomainSettings(s: MedusaSiteSettings): SiteSettings {
  return {
    footerTagline: s.footer_tagline,
    contactPhone: s.contact_phone,
    contactEmail: s.contact_email,
    contactAddress: s.contact_address,
    businessHours: s.business_hours,
    facebookUrl: s.facebook_url,
    instagramUrl: s.instagram_url,
    tiktokUrl: s.tiktok_url,
    announcementText: s.announcement_text,
  };
}

// Never throws — same defensive pattern as getSeoOverride. A missing/
// unreachable settings record must never break the layout it decorates
// (it renders on every single page via RootLayout).
export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const { settings } = await medusaFetch<{ settings: MedusaSiteSettings | null }>("/store/site-settings", {
      next: { revalidate: 60 },
    });
    return settings ? toDomainSettings(settings) : null;
  } catch {
    return null;
  }
}
