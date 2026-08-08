import Link from "next/link";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product/ProductCard";

export function ProductRail({
  title,
  viewAllHref,
  products,
}: {
  title: string;
  viewAllHref?: string;
  products: Product[];
}) {
  if (products.length === 0) return null;

  return (
    <section className="container-shell mt-16 md:mt-24">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl text-ink md:text-3xl">{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-sm font-medium text-accent hover:underline">
            Δες όλα →
          </Link>
        )}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
