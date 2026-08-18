"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { Pagination } from "@/components/category/Pagination";
import type { Product } from "@/lib/types";
import type { ProductSort } from "@/lib/data/products";
import {
  loadMoreCategoryProductsAction,
  loadMoreCollectionProductsAction,
  loadMoreFeaturedProductsAction,
  loadMoreNewArrivalsAction,
  loadMoreSaleProductsAction,
  loadMoreSearchProductsAction,
} from "@/lib/actions/products";

export type ProductSource =
  | { type: "category"; categoryHandle: string }
  | { type: "collection"; collectionHandle: string }
  | { type: "new-arrivals" }
  | { type: "sale" }
  | { type: "featured" }
  | { type: "search"; query: string };

function sourceKeyOf(source: ProductSource): string {
  if (source.type === "category") return `category:${source.categoryHandle}`;
  if (source.type === "collection") return `collection:${source.collectionHandle}`;
  if (source.type === "search") return `search:${source.query}`;
  return source.type;
}

function fetchNextPage(
  source: ProductSource,
  sort: ProductSort,
  offset: number,
  limit: number
): Promise<{ products: Product[]; count: number }> {
  if (source.type === "category") return loadMoreCategoryProductsAction(source.categoryHandle, sort, offset, limit);
  if (source.type === "collection")
    return loadMoreCollectionProductsAction(source.collectionHandle, sort, offset, limit);
  if (source.type === "search") return loadMoreSearchProductsAction(source.query, offset, limit);
  if (source.type === "featured") return loadMoreFeaturedProductsAction(sort, offset, limit);
  if (source.type === "sale") return loadMoreSaleProductsAction(sort, offset, limit);
  return loadMoreNewArrivalsAction(sort, offset, limit);
}

// Renders page 1 (or whichever page was server-rendered) exactly as before,
// then auto-loads subsequent batches as the user scrolls — server-side
// offset/limit pagination underneath, never the full catalog at once. The
// classic Prev/Next control is kept as a real <noscript> fallback: crawlers
// and no-JS visitors get the same fully-crawlable paginated URLs this app
// already had (each with its own canonical, see the page-level
// generateMetadata), JS visitors get the smooth scroll experience instead —
// every product is also independently reachable via sitemap.xml regardless.
export function InfiniteProductGrid({
  source,
  sort,
  page,
  pageSize,
  initialProducts,
  initialCount,
  basePath,
  extraParams,
}: {
  source: ProductSource;
  sort: ProductSort;
  page: number;
  pageSize: number;
  initialProducts: Product[];
  initialCount: number;
  // Plain data, not a closure — a Server Component can't pass a function
  // prop across the boundary into this Client Component, so the crawlable
  // page href is built here instead of by the caller.
  basePath: string;
  extraParams?: Record<string, string>;
}) {
  function buildPageHref(p: number): string {
    const params = new URLSearchParams(extraParams);
    if (sort !== "newest") params.set("sort", sort);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const resetKey = `${sourceKeyOf(source)}:${sort}:${page}`;

  // React's documented "adjust state during render" pattern: when the
  // listing identity (category/search/sort/SSR page) changes, snap straight
  // back to the freshly server-rendered props instead of appending onto a
  // now-stale previous listing (e.g. switching sort must not keep the old
  // sort's loaded items).
  const [state, setState] = useState(() => ({
    resetKey,
    products: initialProducts,
    count: initialCount,
    nextOffset: page * pageSize,
  }));
  if (state.resetKey !== resetKey) {
    setState({ resetKey, products: initialProducts, count: initialCount, nextOffset: page * pageSize });
  }

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(state.count / pageSize));
  const hasMore = state.products.length < state.count;

  function loadMore() {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setError(null);
    const offset = state.nextOffset;

    startTransition(async () => {
      try {
        const result = await fetchNextPage(source, sort, offset, pageSize);
        setState((prev) => {
          if (prev.resetKey !== resetKey) return prev; // a reset landed mid-flight; discard this response
          const seen = new Set(prev.products.map((p) => p.id));
          const merged = [...prev.products, ...result.products.filter((p) => !seen.has(p.id))];
          return { ...prev, products: merged, count: result.count, nextOffset: offset + pageSize };
        });
      } catch {
        setError("Δεν ήταν δυνατή η φόρτωση περισσότερων προϊόντων.");
      } finally {
        loadingRef.current = false;
      }
    });
  }

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    // rootMargin fires the load a little before the sentinel is actually on
    // screen, so the next batch is usually ready by the time the user
    // reaches it — avoids a visible pop-in/stutter on fast mobile scrolling.
    // Re-created (not just re-observed) after every successful batch — see
    // `state.products.length` in the deps — because a fresh `observe()` call
    // always fires once with the *current* intersection state. That's the
    // only way a short list gets a second batch at all: if the sentinel is
    // still inside the margin after appending (viewport taller than the
    // grid), intersection never "changes" again, so a persistent observer
    // would silently stop loading rather than keep chaining batches.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, hasMore, state.products.length]);

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {state.products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {hasMore ? (
        <div ref={sentinelRef} className="mt-10 flex flex-col items-center gap-3 py-4">
          {error ? (
            <>
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
              <button
                type="button"
                onClick={loadMore}
                className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface transition-colors"
              >
                Δοκίμασε ξανά
              </button>
            </>
          ) : (
            // Subtle, small — never a large blocking spinner per the mobile
            // UX requirement. Reserves its own space so nothing jumps when
            // it appears/disappears.
            <div
              className={`h-5 w-5 rounded-full border-2 border-border border-t-accent transition-opacity ${
                isPending ? "animate-spin opacity-100" : "opacity-0"
              }`}
              role="status"
              aria-live="polite"
              aria-label={isPending ? "Φόρτωση περισσότερων προϊόντων…" : undefined}
            />
          )}
        </div>
      ) : (
        state.products.length > pageSize && (
          <p className="mt-10 text-center text-sm text-ink-muted">Είδες όλα τα προϊόντα.</p>
        )
      )}

      <noscript>
        <Pagination currentPage={page} totalPages={totalPages} buildHref={buildPageHref} />
      </noscript>
    </>
  );
}
