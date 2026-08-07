import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { ProductRail } from "@/components/home/ProductRail";
import { EditorialBanner } from "@/components/home/EditorialBanner";
import { TrustStrip } from "@/components/home/TrustStrip";
import { Reviews } from "@/components/home/Reviews";
import { Newsletter } from "@/components/home/Newsletter";
import { getBestSellers, getNewArrivals } from "@/lib/mock-data";

export default function HomePage() {
  const bestSellers = getBestSellers();
  const newArrivals = getNewArrivals();

  return (
    <>
      <Hero />
      <CategoryGrid />
      <ProductRail title="Τα πιο δημοφιλή" viewAllHref="/prosfores?sort=bestseller" products={bestSellers} />
      <EditorialBanner />
      <ProductRail title="Νέες αφίξεις" viewAllHref="/nea-afiksi" products={newArrivals} />
      <TrustStrip />
      <Reviews />
      <Newsletter />
    </>
  );
}
