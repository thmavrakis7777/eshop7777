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
    getFeaturedProducts(12),
    getNewArrivals(12),
  ]);

  return (
    <>
      <Hero />
      <CategoryGrid categories={categories} />
      <ProductRail title="Προτεινόμενα" viewAllHref="/protainomena" products={featured} />
      <EditorialBanner />
      <ProductRail title="Νέες αφίξεις" viewAllHref="/nea-afiksi" products={newArrivals} />
      <TrustStrip />
      <Newsletter />
    </>
  );
}
