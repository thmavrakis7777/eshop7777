import Link from "next/link";
import { BagIcon } from "@/components/ui/Icons";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";

// Explicitly not styled as an error — no red, no warning triangle
// (CART_UX_SPEC.md §6). Reuses RecentlyViewed as-is: if localStorage has
// nothing, that component already renders nothing, so this degrades
// gracefully with zero extra logic here.
export function EmptyCartState({
  compact = false,
  onContinueShopping,
}: {
  compact?: boolean;
  // Mini-cart only: the drawer stays mounted across a client-side
  // navigation (it lives in RootLayout, not the page), so a plain <Link>
  // here would navigate home while leaving the drawer visually open on top
  // of it — CartDrawer's own "Συνέχεια αγορών" button (shown once the cart
  // has items) already closes-then-navigates via this same callback; wire
  // it through here too rather than a second nav implementation. Omitted on
  // the full /kalathi page, where a plain same-destination Link is correct
  // as-is.
  onContinueShopping?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <BagIcon className="h-10 w-10 text-ink-muted" />
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-ink">Το καλάθι σου είναι άδειο.</p>
        <p className="text-sm text-ink-muted">Βρες κάτι που θα αγαπήσεις για το σπίτι σου.</p>
      </div>
      {onContinueShopping ? (
        <button
          type="button"
          onClick={onContinueShopping}
          className="rounded-sm bg-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent"
        >
          Συνέχεια αγορών
        </button>
      ) : (
        <Link
          href="/"
          className="rounded-sm bg-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent"
        >
          Συνέχεια αγορών
        </Link>
      )}
      {!compact && <RecentlyViewed excludeHandle="" />}
    </div>
  );
}
