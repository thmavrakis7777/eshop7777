import type { Metadata } from "next";
import { headers } from "next/headers";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { PromoBannerBar } from "@/components/layout/PromoBannerBar";
import { ConsentBanner } from "@/components/layout/ConsentBanner";
import { AnalyticsScripts } from "@/components/layout/AnalyticsScripts";
import { Header } from "@/components/layout/Header";
import { resolvePhoneOrders } from "@/components/layout/PhoneOrders";
import { getNavItems, type NavItem } from "@/lib/data/navigation";
import { Footer } from "@/components/layout/Footer";
import { CartUIProvider } from "@/components/cart/CartUIProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { AddToCartToast } from "@/components/cart/AddToCartToast";
import { WishlistProvider } from "@/components/wishlist/WishlistProvider";
import { siteUrl } from "@/lib/site-config";
import { safeJsonLd } from "@/lib/json-ld";
import { getBranding } from "@/lib/data/branding";
import type { SiteSettings } from "@/lib/data/site-settings";
import { getNavCategories } from "@/lib/data/categories";
import { getCart } from "@/lib/data/cart";
import { getPromoBanner } from "@/lib/data/promo-banner";
import { getSiteSettings } from "@/lib/data/site-settings";
import { getAnalyticsSettings } from "@/lib/data/analytics-settings";
import { getPublishedLegalPages } from "@/lib/data/content-pages";
import { getCustomerId } from "@/lib/data/customer";

/**
 * Everything the shop wears: announcement bar, promo banner, header, footer,
 * cart drawer, wishlist provider, consent banner, analytics.
 *
 * A route group, so the URLs are unchanged — /kalathi is still /kalathi. The
 * only reason it exists is to stop /admin inheriting any of this.
 */

// Built per-request rather than at module scope: `name`, `logo` and `sameAs`
// all come from admin-editable settings now, so a module-level constant would
// freeze the pre-rename brand into structured data. `logo`/`sameAs` are still
// omitted when there's nothing real to point at — a broken logo URL in
// JSON-LD is worse for SEO than omitting it.
function buildOrganizationJsonLd(
  storeName: string,
  logoUrl: string | null,
  settings: SiteSettings | null
) {
  const sameAs = [settings?.facebookUrl, settings?.instagramUrl, settings?.tiktokUrl].filter(
    (url): url is string => Boolean(url)
  );
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: storeName,
    url: siteUrl,
    ...(logoUrl ? { logo: logoUrl } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        areaServed: "GR",
        availableLanguage: ["el", "en"],
        ...(settings?.contactEmail ? { email: settings.contactEmail } : {}),
        ...(settings?.contactPhone ? { telephone: settings.contactPhone } : {}),
      },
    ],
  };
}

// /anazitisi is a real server-side search (lib/search.ts) with its own `q`
// param — genuinely qualifies for a SearchAction, not added speculatively.
// Google retired the sitelinks search box UI in 2024, so the practical
// payoff is now small, but the markup itself is still valid/harmless.
function buildWebsiteJsonLd(storeName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: storeName,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/anazitisi?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Storefront-wide metadata, resolved from admin settings.
 *
 * Deliberately here and not in the root layout: the root is shared with
 * /admin and does no data fetching on purpose (see its own comment), so
 * putting a settings read there would make every admin page pay for it. A
 * nested layout's `title.template` correctly overrides the parent's, which
 * is what makes the shop renameable without touching the root.
 *
 * The root layout keeps the static site-config values as the build-time
 * fallback, so a missing settings row or an unreachable database still
 * renders sane metadata rather than nothing.
 */
export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: { default: branding.defaultSeoTitle, template: `%s | ${branding.storeName}` },
    description: branding.defaultSeoDescription,
    ...(branding.faviconUrl ? { icons: { icon: branding.faviconUrl } } : {}),
    openGraph: {
      type: "website",
      locale: "el_GR",
      siteName: branding.storeName,
      title: branding.defaultSeoTitle,
      description: branding.defaultSeoDescription,
      url: siteUrl,
      ...(branding.ogImageUrl ? { images: [{ url: branding.ogImageUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: branding.defaultSeoTitle,
      description: branding.defaultSeoDescription,
      ...(branding.ogImageUrl ? { images: [branding.ogImageUrl] } : {}),
    },
  };
}

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [categories, cart, settings, configuredNav, branding, promoBanner, analyticsSettings, legalPages, nonce, customerId] =
    await Promise.all([
      getNavCategories(),
      getCart(),
      getSiteSettings(),
      getNavItems(),
      getBranding(),
      getPromoBanner(),
      getAnalyticsSettings(),
      getPublishedLegalPages(),
      headers().then((h) => h.get("x-nonce") ?? undefined),
      getCustomerId(),
    ]);

  // Permanent fallback, not a migration step: a shop that has never opened
  // the navigation screen still gets a working menu of its top-level
  // categories, exactly as before this feature existed.
  const navItems: NavItem[] =
    configuredNav.length > 0
      ? configuredNav
      : categories.map((c) => ({
          id: c.handle,
          label: c.name,
          href: `/`,
          destinationType: "category" as const,
          categorySlug: c.handle,
          textColor: null,
          backgroundColor: null,
          hoverColor: null,
        }));

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            buildOrganizationJsonLd(branding.storeName, branding.logoUrl, settings)
          ),
        }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: safeJsonLd(buildWebsiteJsonLd(branding.storeName)) }}
      />
      <a
        href="#main-content"
        className="sr-only-focusable fixed left-4 top-4 z-50 rounded-sm bg-ink px-4 py-2 text-sm text-white"
      >
        Μετάβαση στο περιεχόμενο
      </a>
      <WishlistProvider isLoggedIn={customerId !== null}>
        <CartUIProvider>
          <AnnouncementBar
            text={settings?.announcementText ?? null}
            phoneOrders={resolvePhoneOrders(settings)}
          />
          {promoBanner && <PromoBannerBar banner={promoBanner} />}
          <Header
            categories={categories}
            navItems={navItems}
            cartItemCount={cart?.itemCount ?? 0}
            cartTotal={cart?.total ?? { amount: 0, currencyCode: "EUR" }}
            storeName={branding.storeName}
            logoUrl={branding.logoUrl}
          />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer
            categories={categories}
            settings={settings}
            storeName={branding.storeName}
            logoUrl={branding.logoUrl}
            legalPages={legalPages}
          />
          <CartDrawer cartMessage={settings?.cartMessage ?? null} />
          <AddToCartToast />
        </CartUIProvider>
      </WishlistProvider>
      <ConsentBanner settings={analyticsSettings} />
      <AnalyticsScripts settings={analyticsSettings} nonce={nonce} />
    </>
  );
}
