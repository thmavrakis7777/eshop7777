// Shown instantly during a client-side navigation to any (storefront) page
// while that page's own data fetches — the shared layout (header/footer/
// cart) stays mounted and doesn't re-fetch on navigation, so this only
// covers the page content slot. Same spinner visual language as
// InfiniteProductGrid's load-more indicator, just centered and larger.
export default function StorefrontLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Φόρτωση…">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  );
}
