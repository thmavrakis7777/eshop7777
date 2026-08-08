"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { readRecentlyViewedHandles } from "@/lib/recently-viewed-storage";
import { fetchRecentlyViewedProducts } from "@/lib/actions/recently-viewed";
import { ProductRail } from "@/components/home/ProductRail";

export function RecentlyViewed({ excludeHandle }: { excludeHandle: string }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;
    const handles = readRecentlyViewedHandles(excludeHandle);
    if (handles.length === 0) return;

    fetchRecentlyViewedProducts(handles).then((result) => {
      if (!cancelled) setProducts(result);
    });

    return () => {
      cancelled = true;
    };
  }, [excludeHandle]);

  return <ProductRail title="Είδατε πρόσφατα" products={products} />;
}
