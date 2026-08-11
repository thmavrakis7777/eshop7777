import { medusaFetch } from "@/lib/medusa";

// Mirrors apps/backend's src/modules/homepage-blocks model.
export type HomepageBlock = {
  id: string;
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
};

type MedusaHomepageBlock = {
  id: string;
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
};

function toDomainBlock(b: MedusaHomepageBlock): HomepageBlock {
  return {
    id: b.id,
    eyebrow: b.eyebrow,
    heading: b.heading,
    body: b.body,
    ctaLabel: b.cta_label,
    ctaHref: b.cta_href,
    imageUrl: b.image_url,
  };
}

// Never throws — an empty array (not an error) both when nothing's been
// published and when the request fails, since either case means "render
// the component's own default content" to the caller.
export async function getHomepageBlocks(kind: "hero" | "promo"): Promise<HomepageBlock[]> {
  try {
    const { blocks } = await medusaFetch<{ blocks: MedusaHomepageBlock[] }>(`/store/homepage-blocks?kind=${kind}`, {
      next: { revalidate: 60 },
    });
    return blocks.map(toDomainBlock);
  } catch {
    return [];
  }
}
