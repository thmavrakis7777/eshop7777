import { describe, it, expect } from "vitest";
import { isQuantityAvailable, isLineItemOverstocked, quantityCap, stockStateOf } from "./stock";

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

  it("on order («Κατόπιν παραγγελίας») makes any request available once stock is 0", () => {
    expect(isQuantityAvailable(1000, 0, true)).toBe(true);
    expect(isQuantityAvailable(1, 0, true)).toBe(true);
  });

  it("on order does not lift the limit while there is stock (owner, 2026-10-03)", () => {
    expect(isQuantityAvailable(3, 3, true)).toBe(true);
    expect(isQuantityAvailable(5, 3, true)).toBe(false);
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

  it("an on-order line at stock 0 is never overstocked", () => {
    expect(isLineItemOverstocked({ quantity: 999, stockQuantity: 0, allowBackorder: true })).toBe(false);
  });

  it("an on-order product with stock is limited like any other", () => {
    expect(isLineItemOverstocked({ quantity: 5, stockQuantity: 3, allowBackorder: true })).toBe(true);
  });
});

describe("quantityCap", () => {
  it("is the stock, or none while on order", () => {
    expect(quantityCap(3, false)).toBe(3);
    expect(quantityCap(3, true)).toBe(3);
    expect(quantityCap(0, true)).toBeUndefined();
    expect(quantityCap(0, false)).toBe(0);
  });
});

describe("stockStateOf", () => {
  it("any variant on the shelf means in stock", () => {
    expect(stockStateOf([{ inventoryQuantity: 0, allowBackorder: true }, { inventoryQuantity: 2, allowBackorder: false }])).toBe("in_stock");
  });

  it("no stock but orderable means on order", () => {
    expect(stockStateOf([{ inventoryQuantity: 0, allowBackorder: true }])).toBe("on_order");
  });

  it("no stock and not orderable means sold out", () => {
    expect(stockStateOf([{ inventoryQuantity: 0, allowBackorder: false }])).toBe("sold_out");
    expect(stockStateOf([])).toBe("sold_out");
  });
});
