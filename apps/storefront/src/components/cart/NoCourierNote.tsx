import type { CartLineItem } from "@/lib/types";

// The cart page's and drawer's version of the checkout note in
// ShippingSection.tsx: a product a courier won't carry (0045 — gas
// cartridges) limits the whole order to pickup or the Heraklion delivery,
// and the customer should know that before reaching checkout. It takes the
// place of FreeShippingProgress, which is hidden for such a cart. Renders
// nothing for an ordinary cart.
export function NoCourierNote({ items }: { items: CartLineItem[] }) {
  const titles = [...new Set(items.filter((i) => i.noCourier).map((i) => i.title))];
  if (titles.length === 0) return null;
  return (
    <p className="rounded-sm border border-border bg-surface px-3 py-2.5 text-xs text-ink">
      {titles.map((t) => `«${t}»`).join(", ")} {titles.length === 1 ? "δεν αποστέλλεται" : "δεν αποστέλλονται"} με
      courier — μόνο παραλαβή από το κατάστημα ή παράδοση εντός Ηρακλείου.
    </p>
  );
}
