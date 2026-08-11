import { medusaFetch } from "@/lib/medusa";

// Mirrors apps/backend's src/modules/product-extras model. Deliberately
// PDP-only for Phase F — showing badge_label on grid listings (ProductCard
// in category pages, homepage rails, search) would need batch-fetching
// extras across every product-listing call site, a broader change left
// for a follow-up rather than bundled into this phase.
export type ProductExtra = {
  badgeLabel: string | null;
  badgeTone: "accent" | "success" | "neutral";
  warrantyText: string | null;
  downloadsUrl: string | null;
};

type MedusaProductExtra = {
  badge_label: string | null;
  badge_tone: "accent" | "success" | "neutral";
  warranty_text: string | null;
  downloads_url: string | null;
};

// Never throws — same defensive pattern as getSeoOverride.
export async function getProductExtra(productId: string): Promise<ProductExtra | null> {
  try {
    const { extra } = await medusaFetch<{ extra: MedusaProductExtra | null }>(
      `/store/product-extras?product_id=${productId}`,
      { next: { revalidate: 60 } }
    );
    return extra
      ? {
          badgeLabel: extra.badge_label,
          badgeTone: extra.badge_tone,
          warrantyText: extra.warranty_text,
          downloadsUrl: extra.downloads_url,
        }
      : null;
  } catch {
    return null;
  }
}
