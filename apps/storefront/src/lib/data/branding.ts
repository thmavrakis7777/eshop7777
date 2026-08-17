import { cache } from "react";
import { getSiteSettings } from "@/lib/db/content";
import {
  siteDefaultDescription,
  siteDefaultTitle,
  siteName as fallbackSiteName,
} from "@/lib/site-config";

/**
 * Resolved store branding — the single place anything user-visible reads the
 * shop's name, logo, favicon or default SEO copy from.
 *
 * Why this exists: every visible "STIA" used to be its own hardcoded literal
 * (header logo, mobile menu, footer logo + copyright, <title> template,
 * JSON-LD, transactional emails), while `site_setting.store_name` was written
 * by the admin form and read by nothing. Renaming the shop was a code change
 * across ~8 files. Now it's one admin field.
 *
 * lib/site-config.ts stays as the build-time fallback, not the source of
 * truth: it's what renders if the settings row is missing or the database is
 * unreachable, so a branding lookup can never break a page. That fallback is
 * also what `next build` uses for any genuinely static metadata.
 */
export type Branding = {
  storeName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  defaultSeoTitle: string;
  defaultSeoDescription: string;
};

// React.cache: the storefront layout reads branding in both generateMetadata
// and its component body, in the same request. getSiteSettings is already
// unstable_cache'd across requests; this dedupes the two within one.
export const getBranding = cache(async (): Promise<Branding> => {
  const settings = await getSiteSettings();
  const storeName = settings?.storeName?.trim() || fallbackSiteName;
  return {
    storeName,
    logoUrl: settings?.logoUrl ?? null,
    faviconUrl: settings?.faviconUrl ?? null,
    ogImageUrl: settings?.ogImageUrl ?? null,
    // An admin-set default title is used exactly as typed. Otherwise fall
    // back to the static default, but only when the store name is also still
    // the default — a renamed shop with no custom title should read
    // "<New Name>", not the old brand's full marketing title.
    defaultSeoTitle:
      settings?.defaultSeoTitle?.trim() ||
      (storeName === fallbackSiteName ? siteDefaultTitle : storeName),
    defaultSeoDescription: settings?.defaultSeoDescription?.trim() || siteDefaultDescription,
  };
});
