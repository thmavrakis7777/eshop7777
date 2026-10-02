import { describe, it, expect } from "vitest";
import {
  isSameAddressLine,
  normalizePhone,
  normalizePostalCode,
  parseStoreAddress,
  splitStreetAndNumber,
} from "./address-format";
import { isValidPhone, isValidPostalCode } from "./checkout-validation";

// CHECKOUT_PREFILL_GOOGLE_SPEC.md §2.1 / A2–A4: the shapes addresses and
// phone numbers really arrive in from autofill and saved addresses.
describe("splitStreetAndNumber", () => {
  it("takes a plain trailing number off", () => {
    expect(splitStreetAndNumber("Ικάρου 25")).toEqual({ street: "Ικάρου", number: "25" });
  });

  it("keeps a leading ordinal in the street name", () => {
    expect(splitStreetAndNumber("28ης Οκτωβρίου 12Α")).toEqual({ street: "28ης Οκτωβρίου", number: "12Α" });
    expect(splitStreetAndNumber("25ης Μαρτίου 3")).toEqual({ street: "25ης Μαρτίου", number: "3" });
  });

  it("handles a letter after a space, and ranges", () => {
    expect(splitStreetAndNumber("Ικάρου 25 Β")).toEqual({ street: "Ικάρου", number: "25 Β" });
    expect(splitStreetAndNumber("Κνωσού 25-27")).toEqual({ street: "Κνωσού", number: "25-27" });
    expect(splitStreetAndNumber("Λεωφόρος Δημοκρατίας 3/5")).toEqual({ street: "Λεωφόρος Δημοκρατίας", number: "3/5" });
  });

  it("leaves a line with no trailing number whole", () => {
    expect(splitStreetAndNumber("Πλατεία Ελευθερίας")).toEqual({ street: "Πλατεία Ελευθερίας", number: "" });
    expect(splitStreetAndNumber("Λεωφόρος 62 Μαρτύρων")).toEqual({ street: "Λεωφόρος 62 Μαρτύρων", number: "" });
    expect(splitStreetAndNumber("25")).toEqual({ street: "25", number: "" });
    expect(splitStreetAndNumber("")).toEqual({ street: "", number: "" });
  });

  it("collapses stray spaces", () => {
    expect(splitStreetAndNumber("  Ικάρου   25 ")).toEqual({ street: "Ικάρου", number: "25" });
  });

  // The property that makes pre-filling safe: however a line is split,
  // saving joins it back into the same text (lib/actions/checkout.ts).
  it("always joins back into the same address text", () => {
    for (const line of ["Ικάρου 25", "28ης Οκτωβρίου 12Α", "Πλατεία 1866", "Πλατεία Ελευθερίας", "Κνωσού 25-27", "Ικάρου 25 Β"]) {
      const { street, number } = splitStreetAndNumber(line);
      expect(`${street} ${number}`.trim()).toBe(line);
    }
  });
});

describe("normalizePhone / isValidPhone", () => {
  it("strips the Greek country code in every common form", () => {
    expect(normalizePhone("+30 694 123 4567")).toBe("6941234567");
    expect(normalizePhone("+306941234567")).toBe("6941234567");
    expect(normalizePhone("0030 6941234567")).toBe("6941234567");
  });

  it("strips separators", () => {
    expect(normalizePhone("(2810) 751-814")).toBe("2810751814");
    expect(normalizePhone("694.123.4567")).toBe("6941234567");
  });

  it("leaves a foreign number recognisably invalid rather than rewriting it", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(isValidPhone("+44 20 7946 0958")).toBe(false);
  });

  it("accepts autofilled numbers that used to be rejected (A2)", () => {
    expect(isValidPhone("+30 694 123 4567")).toBe(true);
    expect(isValidPhone("6941234567")).toBe(true);
    expect(isValidPhone("694123456")).toBe(false);
  });
});

describe("normalizePostalCode / isValidPostalCode", () => {
  it("accepts the spaced form Greek postal codes are written in (A3)", () => {
    expect(normalizePostalCode("712 01")).toBe("71201");
    expect(isValidPostalCode("712 01")).toBe(true);
    expect(isValidPostalCode(" 71201 ")).toBe(true);
  });

  it("still rejects anything that isn't 5 digits", () => {
    expect(isValidPostalCode("7120")).toBe(false);
    expect(isValidPostalCode("712 011")).toBe(false);
    expect(isValidPostalCode("ABCDE")).toBe(false);
  });
});

describe("isSameAddressLine", () => {
  it("ignores case, spacing and the ΤΚ's space", () => {
    expect(isSameAddressLine({ line: "Ικάρου  25", postalCode: "712 01" }, { line: "ΙΚΆΡΟΥ 25", postalCode: "71201" })).toBe(true);
  });

  it("tells different places apart", () => {
    expect(isSameAddressLine({ line: "Ικάρου 25", postalCode: "71201" }, { line: "Ικάρου 27", postalCode: "71201" })).toBe(false);
    expect(isSameAddressLine({ line: "Ικάρου 25", postalCode: "71201" }, { line: "Ικάρου 25", postalCode: "71202" })).toBe(false);
  });
});

describe("parseStoreAddress", () => {
  // Exactly as saved in Settings → contactAddress on 2026-10-02.
  it("splits the store's own address", () => {
    expect(parseStoreAddress("ΣΦΑΚΙΑΝΑΚΗ 4, 71201, Ηράκλειο Κρήτης")).toEqual({
      streetAddress: "ΣΦΑΚΙΑΝΑΚΗ 4",
      postalCode: "71201",
      addressLocality: "Ηράκλειο Κρήτης",
    });
  });

  it("reads a spaced ΤΚ, a ΤΚ sharing its part with the town, and line breaks", () => {
    const parts = { streetAddress: "Ικάρου 25", postalCode: "71201", addressLocality: "Ηράκλειο" };
    expect(parseStoreAddress("Ικάρου 25, 712 01, Ηράκλειο")).toEqual(parts);
    expect(parseStoreAddress("Ικάρου 25, 71201 Ηράκλειο")).toEqual(parts);
    expect(parseStoreAddress("Ικάρου 25\n712 01 Ηράκλειο")).toEqual(parts);
    expect(parseStoreAddress("  Ικάρου  25 ,  71201 ,  Ηράκλειο ")).toEqual(parts);
  });

  it("returns null for any shape it can't read without guessing", () => {
    expect(parseStoreAddress("Ηράκλειο Κρήτης")).toBeNull(); // no street
    expect(parseStoreAddress("Πλατεία Ελευθερίας, 71202, Ηράκλειο")).toBeNull(); // no house number
    expect(parseStoreAddress("Ικάρου 25, Ηράκλειο, 71201")).toBeNull(); // town before ΤΚ
    expect(parseStoreAddress("Ικάρου 25, 7120, Ηράκλειο")).toBeNull(); // ΤΚ not 5 digits
    expect(parseStoreAddress("Ικάρου 25, Ηράκλειο")).toBeNull(); // no ΤΚ
    expect(parseStoreAddress("Ικάρου 25, 71201, Ηράκλειο, Κρήτη")).toBeNull(); // extra part
    expect(parseStoreAddress("Ικάρου 25, 71201, 2ο χλμ Ηρακλείου")).toBeNull(); // digits in the town
    expect(parseStoreAddress("")).toBeNull();
  });
});
