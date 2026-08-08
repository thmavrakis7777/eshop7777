"use client";

import { useCartUI } from "@/components/cart/CartUIProvider";
import { CloseIcon } from "@/components/ui/Icons";

// Anchored under the header on desktop (docks near the cart icon it just
// updated), anchored to the bottom safe area on mobile (the header is
// frequently scrolled out of view on a mobile PDP, and it's already where
// a thumb is) — see CART_UX_SPEC.md §2. Never opens the drawer itself;
// "Προβολή καλαθιού" is an opt-in action, not automatic.
export function AddToCartToast() {
  const { toast, dismissToast, openDrawer } = useCartUI();

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-4 py-3 shadow-lg pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pb-3 md:inset-x-auto md:bottom-auto md:right-6 md:top-[calc(var(--header-height)+0.75rem)] md:w-80"
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="text-ink">Προστέθηκε στο καλάθι</span>
        <button
          type="button"
          className="font-medium text-accent hover:underline"
          onClick={() => {
            dismissToast();
            openDrawer();
          }}
        >
          Προβολή καλαθιού
        </button>
      </div>
      <button
        type="button"
        className="shrink-0 p-1 text-ink-muted hover:text-ink"
        aria-label="Κλείσιμο ειδοποίησης"
        onClick={dismissToast}
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
