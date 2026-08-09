"use client";

import { HeartIcon } from "@/components/ui/Icons";
import { useWishlist } from "@/components/wishlist/WishlistProvider";

// Reused on ProductCard and the PDP main image — the only place wishlist
// toggle logic lives, same "one component, no drift" rule as ProductCard's
// add-to-cart gating. Deliberately no toast/confirmation beyond the icon
// itself flipping state: a wishlist save is a small, reversible action, not
// a cart mutation, and "never interrupt the shopping experience" was an
// explicit requirement.
export function WishlistButton({
  handle,
  title,
  className,
}: {
  handle: string;
  title: string;
  className?: string;
}) {
  const { has, toggle } = useWishlist();
  const saved = has(handle);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Αφαίρεση ${title} από τη λίστα επιθυμιών` : `Προσθήκη ${title} στη λίστα επιθυμιών`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(handle);
      }}
      className={
        className ??
        "rounded-full bg-bg/90 p-2 text-ink backdrop-blur-sm transition-transform duration-150 ease-out hover:scale-110 active:scale-95"
      }
    >
      <HeartIcon filled={saved} className={`h-5 w-5 ${saved ? "text-accent" : ""}`} />
    </button>
  );
}
