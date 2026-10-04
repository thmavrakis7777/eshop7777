/**
 * The one place "is this quantity actually purchasable?" is decided — the
 * same rule the server-side cart mutations (lib/db/cart.ts) and checkout
 * (lib/db/checkout.ts) enforce, reused here so the Product Page, Cart Page,
 * Mini-Cart and Checkout all read the same yes/no instead of each
 * re-deriving it and risking drift. Pure and dependency-free so it works
 * identically in a Client Component (live typing on the Product Page) and on
 * the server.
 *
 * `allowBackorder` is the product editor's «Κατόπιν παραγγελίας» checkbox
 * (migration 0036). It applies only once the shelf is empty (owner,
 * 2026-10-03): while there is stock, the stock is the limit, exactly as for
 * any other product — asking for more shows the usual contact notice. At
 * stock 0 such a product can be ordered in any quantity; the shop orders it
 * from the supplier and tells the customer the delivery time.
 */
export function isQuantityAvailable(requested: number, stockQuantity: number, allowBackorder: boolean): boolean {
  if (isOnOrder(stockQuantity, allowBackorder)) return true;
  return requested <= stockQuantity;
}

export function isLineItemOverstocked(item: {
  quantity: number;
  stockQuantity: number;
  allowBackorder: boolean;
}): boolean {
  return !isQuantityAvailable(item.quantity, item.stockQuantity, item.allowBackorder);
}

/** True when buying this variant now means the shop orders it in first. */
export function isOnOrder(stockQuantity: number, allowBackorder: boolean): boolean {
  return allowBackorder && stockQuantity <= 0;
}

/** The quantity control's ceiling: the stock, or none while on order. */
export function quantityCap(stockQuantity: number, allowBackorder: boolean): number | undefined {
  return isOnOrder(stockQuantity, allowBackorder) ? undefined : stockQuantity;
}

export type StockState = "in_stock" | "on_order" | "sold_out";

/**
 * A product's headline stock state, for its status line and Google's data.
 * Any variant on the shelf makes it «Σε απόθεμα»; otherwise any variant
 * that can be ordered in makes it «Κατόπιν παραγγελίας».
 */
export function stockStateOf(variants: Array<{ inventoryQuantity: number; allowBackorder: boolean }>): StockState {
  if (variants.some((v) => v.inventoryQuantity > 0)) return "in_stock";
  if (variants.some((v) => isOnOrder(v.inventoryQuantity, v.allowBackorder))) return "on_order";
  return "sold_out";
}

export const ON_ORDER_LABEL = "Κατόπιν παραγγελίας";

// One text for every on-order product (owner's choice): the supplier's time
// isn't known up front, so the promise is to call, not a number of days.
export const ON_ORDER_DELIVERY_TEXT = "Κατόπιν παραγγελίας — θα επικοινωνήσουμε μαζί σας για τον χρόνο παράδοσης";
