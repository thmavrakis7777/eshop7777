import { describe, it, expect } from "vitest";
import { isQuantityAvailable, isLineItemOverstocked } from "./stock";

// The real, single rule the Product Page, Cart Page, Mini-Cart, Checkout,
// and the server-side cart mutations (lib/db/cart.ts) all share — see
// stock.ts's own comment. Testing it once here is testing all of them.

describe("isQuantityAvailable", () => {
  it("zero stock: nothing is available without backorder", () => {
    expect(isQuantityAvailable(1, 0, false)).toBe(false);
  });

  it("stock of exactly 1 covers a request for 1", () => {
    expect(isQuantityAvailable(1, 1, false)).toBe(true);
  });

  it("a request exactly matching stock is available", () => {
    expect(isQuantityAvailable(5, 5, false)).toBe(true);
  });

  it("a request one more than stock is not available", () => {
    expect(isQuantityAvailable(6, 5, false)).toBe(false);
  });

  it("a request far exceeding stock is not available", () => {
    expect(isQuantityAvailable(1000, 15, false)).toBe(false);
  });

  it("backorder allowed makes any positive request available, even with zero stock", () => {
    expect(isQuantityAvailable(1000, 0, true)).toBe(true);
  });

  it("a request of 0 is trivially available (0 <= any non-negative stock)", () => {
    expect(isQuantityAvailable(0, 0, false)).toBe(true);
  });

  it("a negative request is trivially available — validating that a quantity is a positive integer is a separate concern", () => {
    expect(isQuantityAvailable(-1, 0, false)).toBe(true);
  });
});

describe("isLineItemOverstocked", () => {
  it("is the exact negation of isQuantityAvailable for the same inputs", () => {
    const item = { quantity: 15, stockQuantity: 5, allowBackorder: false };
    expect(isLineItemOverstocked(item)).toBe(!isQuantityAvailable(item.quantity, item.stockQuantity, item.allowBackorder));
    expect(isLineItemOverstocked(item)).toBe(true);
  });

  it("a stale cart line within current stock is not overstocked", () => {
    expect(isLineItemOverstocked({ quantity: 3, stockQuantity: 5, allowBackorder: false })).toBe(false);
  });

  it("backorder-enabled lines are never overstocked", () => {
    expect(isLineItemOverstocked({ quantity: 999, stockQuantity: 0, allowBackorder: true })).toBe(false);
  });
});
