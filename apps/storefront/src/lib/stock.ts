/**
 * The one place "is this quantity actually purchasable?" is decided — mirrors
 * the same rule addItem/updateItemQuantity already enforce server-side
 * (lib/db/cart.ts: `allow_backorder || stock_quantity >= quantity`), reused
 * here so the Product Page, Cart Page, Mini-Cart and Checkout all read the
 * same yes/no instead of each re-deriving it and risking drift. Pure and
 * dependency-free so it works identically in a Client Component (live typing
 * on the Product Page) and a Server Action (checkout's pre-flight guard).
 */
export function isQuantityAvailable(requested: number, stockQuantity: number, allowBackorder: boolean): boolean {
  return allowBackorder || requested <= stockQuantity;
}

export function isLineItemOverstocked(item: {
  quantity: number;
  stockQuantity: number;
  allowBackorder: boolean;
}): boolean {
  return !isQuantityAvailable(item.quantity, item.stockQuantity, item.allowBackorder);
}
