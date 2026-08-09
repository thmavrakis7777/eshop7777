"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { HeartIcon } from "@/components/ui/Icons";
import { ProductCard } from "@/components/product/ProductCard";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import { fetchWishlistProducts } from "@/lib/actions/wishlist";

// The empty check reads `handles.length` directly (not `products.length`)
// so removing the last saved item shows the empty state immediately, even
// before the (now-moot) in-flight resolve for the old handle list finishes.
export function WishlistPageView() {
  const { handles } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (handles.length === 0) return;
    let cancelled = false;
    fetchWishlistProducts(handles).then((result) => {
      if (!cancelled) setProducts(result);
    });
    return () => {
      cancelled = true;
    };
  }, [handles]);

  if (handles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <HeartIcon className="h-10 w-10 text-ink-muted" />
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium text-ink">Η λίστα επιθυμιών σου είναι άδεια.</p>
          <p className="text-sm text-ink-muted">Πάτησε την καρδιά σε ένα προϊόν για να το αποθηκεύσεις εδώ.</p>
        </div>
        <Link
          href="/"
          className="rounded-sm bg-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent"
        >
          Συνέχεια αγορών
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
