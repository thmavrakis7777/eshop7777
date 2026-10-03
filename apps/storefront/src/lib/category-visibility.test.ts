import { describe, expect, it } from "vitest";
import { descriptionPlainText, isEmptyListing } from "./category-visibility";

describe("isEmptyListing", () => {
  it("hides a product category with nothing in it or below it", () => {
    expect(isEmptyListing({ pageType: "products", productCount: 0 })).toBe(true);
  });

  it("shows it again from the first product", () => {
    expect(isEmptyListing({ pageType: "products", productCount: 1 })).toBe(false);
  });

  it("never hides a service page, which has no products by design", () => {
    expect(isEmptyListing({ pageType: "landing", productCount: 0 })).toBe(false);
  });
});

describe("descriptionPlainText", () => {
  it("folds the owner's line and paragraph breaks into single spaces", () => {
    expect(descriptionPlainText("Πρώτη παράγραφος.\r\n\r\nΔεύτερη  γραμμή\nκαι τέλος. ")).toBe(
      "Πρώτη παράγραφος. Δεύτερη γραμμή και τέλος."
    );
  });

  it("returns undefined when there is no text", () => {
    expect(descriptionPlainText(undefined)).toBeUndefined();
    expect(descriptionPlainText(null)).toBeUndefined();
    expect(descriptionPlainText(" \n ")).toBeUndefined();
  });
});
