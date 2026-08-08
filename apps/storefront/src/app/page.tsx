import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { ProductRail } from "@/components/home/ProductRail";
import { EditorialBanner } from "@/components/home/EditorialBanner";
import { TrustStrip } from "@/components/home/TrustStrip";
import { Newsletter } from "@/components/home/Newsletter";
import { getNavCategories } from "@/lib/data/categories";
import { getFeaturedProducts, getNewArrivals } from "@/lib/data/products";

export default async function HomePage() {
  const [categories, featured, newArrivals] = await Promise.all([
    getNavCategories(),
    getFeaturedProducts(4),
    getNewArrivals(4),
  ]);

  return (
    <>
      <Hero />
      <CategoryGrid categories={categories} />
      {/* No `viewAllHref` on either rail: /prosfores and /nea-afiksi were
          both real links to routes that have never existed (verified 404).
          ProductRail already treats the prop as optional — a missing link is
          better than a broken one. Restore once those pages are built. */}
      <ProductRail title="Προτεινόμενα" products={featured} />
      <EditorialBanner />
      <ProductRail title="Νέες αφίξεις" products={newArrivals} />
      <TrustStrip />
      <Newsletter />
    </>
  );
}
