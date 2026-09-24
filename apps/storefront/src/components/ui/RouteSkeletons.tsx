import type { ReactNode } from "react";

/**
 * Route-level loading states (the `loading.tsx` files) — what a shopper sees
 * in the frame after tapping a link, instead of the old page sitting frozen
 * for 0.5–1.65 s while the next one renders on the server (Speed audit
 * PERF-005/SPD-04).
 *
 * Each one copies its real page's container, spacing and grid so the swap to
 * real content moves nothing that was already on screen. Headings that are
 * known without data (cart, checkout) are real copy, the same rule as
 * ProductRailSkeleton; everything data-dependent is a neutral block.
 *
 * Only ever rendered by a `loading.tsx` that sits *below* a layout which has
 * already checked the page exists — see the note in
 * (storefront)/proionta/[handle]/layout.tsx on why that ordering is what
 * keeps a missing URL a real 404.
 */

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-sm bg-surface ${className}`} />;
}

// Announced once to screen readers; the blocks themselves are decorative.
function Loading({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Φόρτωση…</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

function BreadcrumbBar() {
  return (
    <div className="container-shell pt-4">
      <Bar className="h-4 w-48" />
    </div>
  );
}

// CategoryPLPView: category pages at every depth, and search results.
export function ListingSkeleton() {
  return (
    <Loading>
      <BreadcrumbBar />
      <div className="container-shell mt-4">
        <Bar className="h-9 w-56 md:h-10" />
        <div className="mt-8 flex items-center justify-between gap-3 border-b border-border pb-4">
          <Bar className="h-4 w-24" />
          <Bar className="h-9 w-40" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <Bar className="aspect-square w-full rounded-md" />
              <Bar className="mt-3 h-4 w-3/4" />
              <Bar className="mt-2 h-4 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </Loading>
  );
}

// proionta/[handle]/page.tsx: image left, buy box right (stacked on mobile).
export function ProductPageSkeleton() {
  return (
    <Loading>
      <BreadcrumbBar />
      <div className="container-shell mt-4 grid grid-cols-1 gap-8 md:mt-8 md:grid-cols-2 md:gap-12">
        <Bar className="aspect-square w-full rounded-md" />
        <div>
          <Bar className="h-9 w-3/4" />
          <Bar className="mt-4 h-7 w-24" />
          <Bar className="mt-8 h-11 w-36" />
          <Bar className="mt-4 h-[52px] w-full" />
          <Bar className="mt-8 h-4 w-2/3" />
          <Bar className="mt-3 h-4 w-1/2" />
        </div>
      </div>
    </Loading>
  );
}

// kalathi/page.tsx + CartPageView: rows left, summary right on desktop.
export function CartSkeleton() {
  return (
    <Loading>
      <div className="container-shell py-8 md:py-12">
        <h1 className="mb-6 font-display text-2xl md:text-3xl">Το καλάθι σου</h1>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Bar className="h-24 w-24 flex-none rounded-md" />
                <div className="flex-1">
                  <Bar className="h-4 w-2/3" />
                  <Bar className="mt-3 h-4 w-1/4" />
                  <Bar className="mt-4 h-9 w-28" />
                </div>
              </div>
            ))}
          </div>
          <Bar className="h-64 w-full rounded-md" />
        </div>
      </div>
    </Loading>
  );
}

// checkout/page.tsx + CheckoutForm: form left, order summary right.
export function CheckoutSkeleton() {
  return (
    <Loading>
      <div className="container-shell py-8 md:py-12">
        <h1 className="mb-8 font-display text-2xl md:text-3xl">Ολοκλήρωση παραγγελίας</h1>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Bar key={i} className="h-12 w-full" />
            ))}
          </div>
          <Bar className="h-80 w-full rounded-md" />
        </div>
      </div>
    </Loading>
  );
}
