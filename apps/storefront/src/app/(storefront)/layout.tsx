import { headers } from "next/headers";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { PromoBannerBar } from "@/components/layout/PromoBannerBar";
import { ConsentBanner } from "@/components/layout/ConsentBanner";
import { AnalyticsScripts } from "@/components/layout/AnalyticsScripts";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartUIProvider } from "@/components/cart/CartUIProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { AddToCartToast } from "@/components/cart/AddToCartToast";
import { WishlistProvider } from "@/components/wishlist/WishlistProvider";
import { siteName, siteUrl } from "@/lib/site-config";
import { getNavCategories } from "@/lib/data/categories";
import { getCart } from "@/lib/data/cart";
import { getPromoBanner } from "@/lib/data/promo-banner";
import { getSiteSettings } from "@/lib/data/site-settings";
import { getAnalyticsSettings } from "@/lib/data/analytics-settings";

/**
 * Everything the shop wears: announcement bar, promo banner, header, footer,
 * cart drawer, wishlist provider, consent banner, analytics.
 *
 * A route group, so the URLs are unchanged — /kalathi is still /kalathi. The
 * only reason it exists is to stop /admin inheriting any of this.
 */

// No `logo`/`sameAs` yet — there's no real logo asset or social presence to
// point to. A broken logo URL in JSON-LD is worse for SEO than omitting it.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer service",
      areaServed: "GR",
      availableLanguage: ["el", "en"],
    },
  ],
};

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [categories, cart, settings, promoBanner, analyticsSettings, nonce] = await Promise.all([
    getNavCategories(),
    getCart(),
    getSiteSettings(),
    getPromoBanner(),
    getAnalyticsSettings(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <a
        href="#main-content"
        className="sr-only-focusable fixed left-4 top-4 z-50 rounded-sm bg-ink px-4 py-2 text-sm text-white"
      >
        Μετάβαση στο περιεχόμενο
      </a>
      <WishlistProvider>
        <CartUIProvider>
          <AnnouncementBar text={settings?.announcementText ?? null} />
          {promoBanner && <PromoBannerBar banner={promoBanner} />}
          <Header
            categories={categories}
            cartItemCount={cart?.itemCount ?? 0}
            cartTotal={cart?.total ?? { amount: 0, currencyCode: "EUR" }}
          />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer categories={categories} settings={settings} />
          <CartDrawer cartMessage={settings?.cartMessage ?? null} />
          <AddToCartToast />
        </CartUIProvider>
      </WishlistProvider>
      <ConsentBanner settings={analyticsSettings} />
      <AnalyticsScripts settings={analyticsSettings} nonce={nonce} />
    </>
  );
}
