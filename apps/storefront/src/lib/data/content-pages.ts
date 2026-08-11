import { medusaFetch } from "@/lib/medusa";

// Mirrors apps/backend's src/modules/content-pages model. Slug is one of a
// fixed set with a matching literal storefront route folder (app/{slug}/
// page.tsx) — not an open-ended CMS slug.
export type ContentPage = {
  title: string;
  body: string | null;
};

type MedusaContentPage = {
  title: string;
  body: string | null;
  is_published: boolean;
};

// Never throws — same defensive pattern as getSeoOverride/getSiteSettings.
// Returns null both when the page doesn't exist and when it exists but
// isn't published (the backend's /store route already enforces that; this
// never sees an unpublished page's content at all).
export async function getContentPage(slug: string): Promise<ContentPage | null> {
  try {
    const { page } = await medusaFetch<{ page: MedusaContentPage | null }>(
      `/store/content-pages?slug=${encodeURIComponent(slug)}`,
      { next: { revalidate: 60 } }
    );
    return page ? { title: page.title, body: page.body } : null;
  } catch {
    return null;
  }
}
