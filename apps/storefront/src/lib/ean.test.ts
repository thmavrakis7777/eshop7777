import { describe, expect, it } from "vitest";
import { isValidEan, normalizeEan } from "./ean";

describe("normalizeEan", () => {
  it("drops spaces and dashes from a typed or scanned code", () => {
    expect(normalizeEan(" 520 1234 567893 ")).toBe("5201234567893");
    expect(normalizeEan("5201-2345-67893")).toBe("5201234567893");
  });
});

describe("isValidEan", () => {
  it("accepts real codes of every GTIN length", () => {
    expect(isValidEan("4006381333931")).toBe(true); // EAN-13
    expect(isValidEan("96385074")).toBe(true); // EAN-8
    expect(isValidEan("036000291452")).toBe(true); // UPC-A
    expect(isValidEan("10012345678902")).toBe(true); // GTIN-14
  });

  it("rejects a wrong check digit (a mistyped number)", () => {
    expect(isValidEan("4006381333932")).toBe(false);
    expect(isValidEan("4006381333913")).toBe(false); // two digits swapped
  });

  it("rejects other lengths and non-digits", () => {
    expect(isValidEan("")).toBe(false);
    expect(isValidEan("12345")).toBe(false);
    expect(isValidEan("40063813339311")).toBe(false); // 14 digits, wrong check
    expect(isValidEan("400638133393A")).toBe(false);
    expect(isValidEan("123456789012345")).toBe(false);
  });
});
