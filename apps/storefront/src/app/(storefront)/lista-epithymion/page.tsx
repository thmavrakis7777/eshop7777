import type { Metadata } from "next";
import { WishlistPageView } from "@/components/wishlist/WishlistPageView";

// Personalized, per-browser content (localStorage-backed, same as /kalathi)
// — noindex, self-canonical. See PRODUCT_CARD_WISHLIST_PDP_SPEC.md §2.
export const metadata: Metadata = {
  title: "Λίστα Επιθυμιών",
  robots: { index: false, follow: true },
  alternates: { canonical: "/lista-epithymion" },
};

export default function WishlistPage() {
  return (
    <div className="container-shell py-8 md:py-12">
      <h1 className="mb-6 font-display text-2xl md:text-3xl">Λίστα Επιθυμιών</h1>
      <WishlistPageView />
    </div>
  );
}
