import "server-only";
import type { Metadata } from "next";
import { categoryPathHref, getCategoryPath } from "@/lib/data/categories";
import { getSeoOverride } from "@/lib/data/seo";
import { canonicalListingPath, hasAnyFilterParam, parsePage } from "@/lib/search-params";
import { siteUrl } from "@/lib/site-config";
import { publicImageUrl } from "@/lib/storage/urls";

/**
 * Metadata for a category page at any depth.
 *
 * One implementation for all three route levels: they differed only in how
 * many segments went into the canonical URL, which the resolved ancestor
 * chain now supplies. Keeping it in one place is what stops the levels
 * drifting apart — the sub-subcategory route gets admin SEO overrides,
 * canonical handling and OG tags identical to the top level for free, rather
 * than by a third copy someone has to remember to update.
 */
export async function categoryMetadata(
  segments: string[],
  pageParam?: string,
  searchParams: Record<string, string | string[] | undefined> = {}
): Promise<Metadata> {
  const path = await getCategoryPath(segments);
  if (!path) return {};
  const { category, ancestors } = path;

  // Admin-editable SEO overrides (Admin-first platform, Phase B) — same
  // fallback pattern as product SEO. The canonical override only applies to
  // page 1: deeper pages must keep self-canonicalising to their own ?page=N
  // URL (see canonicalListingPath), or Google would see every page as a
  // duplicate of an admin-picked URL instead of a distinct, indexable page.
  const seo = await getSeoOverride("category", category.id);
  const page = parsePage(pageParam);
  const title = seo?.seoTitle || category.name;
  // 'landing' categories are a physical-store service, not a product
  // listing — the shipping-focused default description would be actively
  // wrong for one, so it only applies to a real product category.
  const description =
    seo?.metaDescription ||
    (category.pageType === "landing"
      ? `${category.name} — υπηρεσία διαθέσιμη στο φυσικό μας κατάστημα.`
      : `${category.name} — ποιοτικά προϊόντα για το σπίτι σου, με γρήγορη παράδοση σε όλη την Ελλάδα.`);

  const href = categoryPathHref(ancestors, category);
  const canonical = page === 1 && seo?.canonicalUrl ? seo.canonicalUrl : canonicalListingPath(href, page);

  // Filtered URLs (?material=..., ?price_min=..., etc.) must stay crawlable
  // (internal links still followed) but never indexed — same treatment as an
  // admin-set noindex — or every filter combination becomes a duplicate URL
  // competing with the one real, canonical category page.
  const noindex = seo?.robots === "noindex" || hasAnyFilterParam(searchParams);
  // Falls back to the category's own uploaded image when no admin override
  // is set — found missing in a full project audit (mirrors the pattern
  // journal/[slug]/page.tsx already uses; product pages just got the same
  // fix). imagePath is a storage path, not a public URL, so it needs the
  // same derivation every other image on this site goes through.
  const image = seo?.socialImageUrl || publicImageUrl(category.imagePath) || undefined;

  return {
    title: seo?.seoTitle ? { absolute: seo.seoTitle } : title,
    description,
    alternates: { canonical },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      url: `${siteUrl}${canonical}`,
      ...(image ? { images: [{ url: image, alt: category.name }] } : {}),
    },
    // Without its own `twitter` block, every category-depth route silently
    // inherited the root layout's generic site-wide one (Next only replaces
    // a parent metadata key when the child declares that same key).
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      ...(image ? { images: [image] } : {}),
    },
    ...(seo?.keywords ? { keywords: seo.keywords } : {}),
  };
}
