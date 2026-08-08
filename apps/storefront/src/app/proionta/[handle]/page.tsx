import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/category/Breadcrumbs";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { RecentlyViewedTracker } from "@/components/product/RecentlyViewedTracker";
import { ProductRail } from "@/components/home/ProductRail";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import { Stars } from "@/components/ui/Stars";
import { getCategoryByHandle } from "@/lib/data/categories";
import { getProductByHandle, getRelatedProducts } from "@/lib/data/products";
import { formatPrice } from "@/lib/format";
import { siteUrl } from "@/lib/site-config";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) return {};

  return {
    title: product.title,
    description: product.shortDescription || product.title,
    alternates: { canonical: `/proionta/${product.handle}` },
    openGraph: {
      title: product.title,
      description: product.shortDescription || product.title,
      url: `${siteUrl}/proionta/${product.handle}`,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) notFound();

  // Related products don't depend on the category lookups, so they're
  // fetched alongside rather than after them — this was a three-deep
  // request waterfall before.
  const [category, relatedProducts] = await Promise.all([
    product.categoryHandle ? getCategoryByHandle(product.categoryHandle) : undefined,
    getRelatedProducts(product),
  ]);
  const parentCategory = category?.parentHandle ? await getCategoryByHandle(category.parentHandle) : undefined;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription || product.title,
    // Medusa's real variant SKU — the same value shown as "Κωδικός
    // προϊόντος" below. Omitted rather than faked when a variant has none.
    ...(product.code ? { sku: product.code } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: product.price.currencyCode,
      price: product.price.amount,
      availability: product.isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${siteUrl}/proionta/${product.handle}`,
    },
  };

  const breadcrumbItems = category
    ? [
        ...(parentCategory ? [{ label: parentCategory.name, href: `/${parentCategory.handle}` }] : []),
        {
          label: category.name,
          href: parentCategory ? `/${parentCategory.handle}/${category.handle}` : `/${category.handle}`,
        },
        { label: product.title, href: `/proionta/${product.handle}` },
      ]
    : [{ label: product.title, href: `/proionta/${product.handle}` }];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <RecentlyViewedTracker handle={product.handle} />
      <Breadcrumbs items={breadcrumbItems} />

      <div className="container-shell mt-4 grid grid-cols-1 gap-8 md:mt-8 md:grid-cols-2 md:gap-12">
        <PlaceholderTile label={product.title} tone={product.placeholderTone} className="md:sticky md:top-24" />

        <div className="flex flex-col">
          <h1 className="text-3xl text-ink md:text-4xl">{product.title}</h1>

          {product.rating !== undefined && (
            <div className="mt-3">
              <Stars rating={product.rating} count={product.reviewCount} />
            </div>
          )}

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-ink">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-base text-ink-muted line-through">{formatPrice(product.compareAtPrice)}</span>
            )}
          </div>

          {product.shortDescription && (
            <p className="mt-6 text-sm leading-relaxed text-ink-muted md:text-base">{product.shortDescription}</p>
          )}

          <div className="mt-8">
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
              <dd className="text-ink">2-3 εργάσιμες σε όλη την Ελλάδα</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Επιστροφές</dt>
              <dd className="text-ink">Δωρεάν εντός 30 ημερών</dd>
            </div>
            {/* Reconciled with what checkout can actually offer: the only
                configured Medusa payment provider is pp_system_default,
                presented as "Αντικαταβολή". The previous "Κάρτα, Viva
                Wallet, αντικαταβολή" was aspirational copy that checkout
                visibly contradicted. */}
            <div className="flex justify-between">
              <dt className="text-ink-muted">Πληρωμή</dt>
              <dd className="text-ink">Αντικαταβολή κατά την παράδοση</dd>
            </div>
          </dl>
        </div>
      </div>

      <ProductRail title="Σχετικά προϊόντα" products={relatedProducts} />
      <RecentlyViewed excludeHandle={product.handle} />
    </>
  );
}
