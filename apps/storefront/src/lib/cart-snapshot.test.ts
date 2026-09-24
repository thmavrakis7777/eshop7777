import { describe, it, expect } from "vitest";
import { displayedCart, newerCart } from "./cart-snapshot";
import type { Cart, Money } from "@/lib/types";

// SPD-08: cart actions no longer re-render the page, so the browser's one
// shared cart is fed by several sources that can arrive in any order. These
// two functions are the whole ordering policy (CART_STATE_SPEC.md §3).

const eur = (amount: number): Money => ({ amount, currencyCode: "EUR" });

function cart(fetchedAt: number, itemCount = 1): Cart {
  return {
    id: "c1",
    items: [],
    itemCount,
    subtotal: eur(10),
    discountTotal: eur(0),
    shippingTotal: eur(0),
    vatTotal: eur(1.94),
    vatRate: 24,
    hasShippingMethod: false,
    total: eur(10),
    promotions: [],
    taxDocumentType: "receipt",
    fetchedAt,
  };
}

describe("newerCart", () => {
  it("keeps the newer snapshot, whichever order they arrive in", () => {
    const old = cart(1_000, 1);
    const fresh = cart(2_000, 3);
    expect(newerCart(old, fresh)).toBe(fresh);
    // e.g. a page restored by the Back button handing in the cart it had back then
    expect(newerCart(fresh, old)).toBe(fresh);
  });

  it("takes the incoming copy on a tie", () => {
    const a = cart(1_000);
    const b = cart(1_000);
    expect(newerCart(a, b)).toBe(b);
  });

  it("accepts null (no cart / expired / ordered) from any fresh answer", () => {
    expect(newerCart(cart(1_000), null)).toBeNull();
  });

  it("takes the first cart when there was none", () => {
    const c = cart(1_000);
    expect(newerCart(null, c)).toBe(c);
  });
});

describe("displayedCart", () => {
  it("shows the shared copy on a tie, so optimistic edits stay visible", () => {
    // After the page stores its snapshot both carry the same fetchedAt, but
    // only the shared one has the shopper's pending +/− applied.
    const page = cart(1_000, 1);
    // What patchCart produces: same snapshot, same fetchedAt, local edit on top.
    const sharedWithEdit: Cart = { ...page, itemCount: 2 };
    expect(displayedCart(sharedWithEdit, page).itemCount).toBe(2);
  });

  it("shows the page's own snapshot while the shared copy is older (first paint of a fresh visit)", () => {
    const shared = cart(1_000);
    const page = cart(2_000);
    expect(displayedCart(shared, page)).toBe(page);
  });

  it("ignores a stale page snapshot restored by Back/Forward", () => {
    const shared = cart(2_000, 4);
    const stalePage = cart(1_000, 1);
    expect(displayedCart(shared, stalePage)).toBe(shared);
  });

  it("falls back to the page's snapshot when there is no shared cart", () => {
    const page = cart(1_000);
    expect(displayedCart(null, page)).toBe(page);
  });
});
