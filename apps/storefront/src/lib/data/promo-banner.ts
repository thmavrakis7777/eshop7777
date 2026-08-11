import { medusaFetch } from "@/lib/medusa";

// Mirrors apps/backend's src/modules/promo-banner model. Deliberately not
// named "campaign" — that collides with Medusa's own native Campaign
// entity (part of the built-in Promotions module).
export type PromoBanner = {
  headline: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  endsAt: string | null;
};

type MedusaPromoBanner = {
  headline: string | null;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  ends_at: string | null;
};

// Never throws — same defensive pattern as getSiteSettings. The backend
// already gates on is_published/expiry, so any non-null response here is
// meant to be shown as-is.
export async function getPromoBanner(): Promise<PromoBanner | null> {
  try {
    const { banner } = await medusaFetch<{ banner: MedusaPromoBanner | null }>("/store/promo-banner", {
      next: { revalidate: 30 },
    });
    return banner
      ? {
          headline: banner.headline,
          body: banner.body,
          ctaLabel: banner.cta_label,
          ctaHref: banner.cta_href,
          endsAt: banner.ends_at,
        }
      : null;
  } catch {
    return null;
  }
}
