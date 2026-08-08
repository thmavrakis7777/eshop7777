import Link from "next/link";
import { BagIcon } from "@/components/ui/Icons";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";

// Explicitly not styled as an error — no red, no warning triangle
// (CART_UX_SPEC.md §6). Reuses RecentlyViewed as-is: if localStorage has
// nothing, that component already renders nothing, so this degrades
// gracefully with zero extra logic here.
export function EmptyCartState({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <BagIcon className="h-10 w-10 text-ink-muted" />
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-ink">Το καλάθι σου είναι άδειο.</p>
        <p className="text-sm text-ink-muted">Βρες κάτι που θα αγαπήσεις για το σπίτι σου.</p>
      </div>
      <Link
        href="/"
        className="rounded-sm bg-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent"
      >
        Συνέχεια αγορών
      </Link>
      {!compact && <RecentlyViewed excludeHandle="" />}
    </div>
  );
}
