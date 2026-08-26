import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Breadcrumbs } from "@/components/category/Breadcrumbs";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { RecentlyViewedTracker } from "@/components/product/RecentlyViewedTracker";
import { ViewContentTracker } from "@/components/product/ViewContentTracker";
import { StockStatus } from "@/components/product/StockStatus";
import { ProductCharacteristics } from "@/components/product/ProductCharacteristics";
import { ProductWarranty } from "@/components/product/ProductWarranty";
import { ProductRail } from "@/components/home/ProductRail";
import { ProductRailSkeleton } from "@/components/home/ProductRailSkeleton";
import { ProductImage } from "@/components/ui/ProductImage";
import { Stars } from "@/components/ui/Stars";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { categoryPathHref, getCategoryTrail } from "@/lib/data/categories";
import { getProductByHandle, getRelatedProducts } from "@/lib/data/products";
import type { Product } from "@/lib/types";
import { getProductExtra } from "@/lib/data/product-extras";
import { getSiteSettings } from "@/lib/data/site-settings";
import { getSeoOverride } from "@/lib/data/seo";
import { formatPrice, formatPriceFrom } from "@/lib/format";
import { siteUrl } from "@/lib/site-config";
import { safeJsonLd } from "@/lib/json-ld";

// Below the fold and independent of everything else on the page — its own
// Suspense boundary so a slow related-products query doesn't gate the PDP.
async function RelatedProducts({ product }: { product: Product }) {
  const relatedProducts = await getRelatedProducts(product);
  return <ProductRail title="Σχετικά προϊόντα" products={relatedProducts} />;
}

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) return {};

  // Admin-editable SEO overrides (Admin-first platform, Phase A) — every
  // field intelligently falls back to the existing generated default when
  // left empty, never a blank title/description.
  const seo = await getSeoOverride("product", product.id);
  const title = seo?.seoTitle || product.title;
  const description = seo?.metaDescription || product.shortDescription || product.title;
  const canonicalPath = seo?.canonicalUrl || `/proionta/${product.handle}`;

  return {
    // RootLayout's title template appends " | STIA" to every plain string
    // title — correct for the generated default, but an admin-entered SEO
    // Title is meant to be the exact, final <title> tag they typed, not run
    // through that template again (which would double up the site name).
    // `absolute` opts out of the parent template for this one page.
    title: seo?.seoTitle ? { absolute: seo.seoTitle } : title,
    description,
    alternates: { canonical: canonicalPath },
    ...(seo?.robots === "noindex" ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      url: `${siteUrl}${canonicalPath}`,
      ...(seo?.socialImageUrl ? { images: [{ url: seo.socialImageUrl }] } : {}),
    },
    ...(seo?.keywords ? { keywords: seo.keywords } : {}),
  };
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) notFound();

  // getCategoryTrail returns the whole chain of ancestors, not just the
  // immediate parent, and reads the category tree the layout's nav has
  // already loaded on this request — so it costs no query at all, where the
  // parent lookup it replaces cost one. The chain is what makes the
  // breadcrumb links work: a third-level category's URL contains its
  // grandparent, so a product in Τηγάνια used to link to /mageirika-skeyi
  // and /mageirika-skeyi/tigania, both of which 404. Related products moved
  // to their own Suspense boundary below (see RelatedProducts) — below the
  // fold and independent, no reason for it to gate the rest of the page.
  const [categoryTrail, seo, extra, siteSettings, nonce] = await Promise.all([
    product.categoryHandle ? getCategoryTrail(product.categoryHandle) : undefined,
    getSeoOverride("product", product.id),
    getProductExtra(product.id),
    getSiteSettings(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  // Per-product override, falling back to the site-wide default — both
  // owner-editable (product edit page / Content → Header & Footer). `||` not
  // `??`: an override saved as '' means "cleared back to the default," not
  // "show a blank line" (this schema's empty-string-is-unset convention).
  const deliveryText = extra?.deliveryTextOverride || siteSettings?.pdpDeliveryText || "2-3 εργάσιμες σε όλη την Ελλάδα";
  const returnsText = extra?.returnsTextOverride || siteSettings?.pdpReturnsText || "Δωρεάν εντός 30 ημερών";
  const paymentText = extra?.paymentTextOverride || siteSettings?.pdpPaymentText || "Αντικαταβολή κατά την παράδοση";

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription || product.title,
    // Only when a real photo exists — no placeholder/fabricated image URL,
    // same "only what's populated" rule as material/weight below.
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    // Medusa's real variant SKU — the same value shown as "Κωδικός
    // προϊόντος" below. Omitted rather than faked when a variant has none.
    ...(product.code ? { sku: product.code } : {}),
    // Real Medusa product attributes, same "only what's populated" rule as
    // the visible Characteristics section (§4 of the spec) — schema.org's
    // QuantitativeValue shape for weight/dimensions.
    ...(product.characteristics?.material ? { material: product.characteristics.material } : {}),
    ...(product.characteristics?.weightGrams != null
      ? { weight: { "@type": "QuantitativeValue", value: product.characteristics.weightGrams, unitCode: "GRM" } }
      : {}),
    // AggregateOffer (not a single Offer) when variants don't share one
    // price — a single `price` would be schema.org-incorrect once it's only
    // true for one of several variants.
    offers: product.priceRange
      ? {
          "@type": "AggregateOffer",
          priceCurrency: product.priceRange.min.currencyCode,
          lowPrice: product.priceRange.min.amount,
          highPrice: product.priceRange.max.amount,
          offerCount: product.variants.length,
          availability: product.isAvailable
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: `${siteUrl}/proionta/${product.handle}`,
        }
      : {
          "@type": "Offer",
          priceCurrency: product.price.currencyCode,
          price: product.price.amount,
          availability: product.isAvailable
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: `${siteUrl}/proionta/${product.handle}`,
        },
    // Admin-editable escape hatch for the rare product that needs a real
    // structured-data field this generator doesn't produce — merged on top
    // rather than replacing wholesale, so a partial override (e.g. just
    // `brand`) doesn't silently drop sku/offers/material.
    ...(seo?.structuredDataOverride ?? {}),
  };

  const breadcrumbItems = [
    ...(categoryTrail ?? []).map((c, i) => ({
      label: c.name,
      href: categoryPathHref(categoryTrail!.slice(0, i), c),
    })),
    { label: product.title, href: `/proionta/${product.handle}` },
  ];

  return (
    <>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: safeJsonLd(productJsonLd) }} />
      <RecentlyViewedTracker handle={product.handle} />
      <ViewContentTracker id={product.id} title={product.title} priceAmount={product.price.amount} />
      <Breadcrumbs items={breadcrumbItems} />

      <div className="container-shell mt-4 grid grid-cols-1 gap-8 md:mt-8 md:grid-cols-2 md:gap-12">
        <div className="relative md:sticky md:top-24 md:self-start">
          <ProductImage
            imageUrl={product.imageUrl}
            label={product.title}
            tone={product.placeholderTone}
            sizes="(min-width: 768px) 50vw, 100vw"
          />
          <WishlistButton
            handle={product.handle}
            title={product.title}
            className="absolute right-3 top-3 rounded-full bg-bg/90 p-2.5 text-ink backdrop-blur-sm transition-transform duration-150 ease-out hover:scale-110 active:scale-95"
          />
        </div>

        <div className="flex flex-col">
          {extra?.badgeLabel && (
            <span
              className={`mb-2 inline-flex w-fit rounded-sm px-2 py-1 text-[11px] font-medium tracking-wide ${
                extra.badgeTone === "accent"
                  ? "bg-accent text-white"
                  : extra.badgeTone === "success"
                    ? "bg-success text-white"
                    : "bg-surface text-ink"
              }`}
            >
              {extra.badgeLabel}
            </span>
          )}
          <h1 className="text-3xl text-ink md:text-4xl">{product.title}</h1>

          {product.rating !== undefined && (
            <div className="mt-3">
              <Stars rating={product.rating} count={product.reviewCount} />
            </div>
          )}

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-ink">
              {product.priceRange ? formatPriceFrom(product.priceRange.min) : formatPrice(product.price)}
            </span>
            {!product.priceRange && product.compareAtPrice && (
              <span className="text-base text-ink-muted line-through">{formatPrice(product.compareAtPrice)}</span>
            )}
          </div>

          <StockStatus isAvailable={product.isAvailable} className="mt-4" />

          <div className="mt-3">
            <AddToCartButton
              product={product}
              className="w-full rounded-sm bg-ink px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:px-10"
            />
          </div>

          <dl className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-sm">
            {product.code && (
              <div className="flex justify-between">
                <dt className="text-ink-muted">Κωδικός προϊόντος</dt>
                <dd className="text-ink">{product.code}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-muted">Παράδοση</dt>
              <dd className="text-ink">{deliveryText}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Επιστροφές</dt>
              <dd className="text-ink">{returnsText}</dd>
            </div>
            {/* Editable from Settings → Content → Header & Footer (global
                default) or this product's own edit page (override) — see
                MIGRATION_PLAN.md. Reconciled with what checkout can actually
                offer by default: only "Αντικαταβολή" until real payment
                methods are configured (Settings → Payments). */}
            <div className="flex justify-between">
              <dt className="text-ink-muted">Πληρωμή</dt>
              <dd className="text-ink">{paymentText}</dd>
            </div>
          </dl>
        </div>
      </div>

      {product.shortDescription && (
        <section className="container-shell mt-12 max-w-2xl md:mt-16">
          <h2 className="font-display text-xl text-ink md:text-2xl">Περιγραφή</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-muted md:text-base">
            {product.shortDescription}
          </p>
        </section>
      )}

      <ProductCharacteristics characteristics={product.characteristics} />
      <ProductWarranty extra={extra} />

      <Suspense fallback={<ProductRailSkeleton title="Σχετικά προϊόντα" />}>
        <RelatedProducts product={product} />
      </Suspense>
      <RecentlyViewed excludeHandle={product.handle} />
    </>
  );
}
