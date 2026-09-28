import { describe, it, expect } from "vitest";
import { buildCheckoutPrefill, detailsFromSavedAddress, findSavedAddress } from "./checkout-prefill";
import type { Customer, CustomerAddress } from "./types";

// CHECKOUT_PREFILL_GOOGLE_SPEC.md §2.1: cart first, then the account's
// saved address, then the profile alone, else empty.

const customer: Customer = { id: "c1", email: "maria@example.com", firstName: "Μαρία", lastName: "Παπαδάκη", phone: "6941234567" };

const saved = (over: Partial<CustomerAddress> = {}): CustomerAddress => ({
  id: "a1",
  isDefaultShipping: true,
  firstName: "Μαρία",
  lastName: "Παπαδάκη",
  street: "Ικάρου",
  number: "25",
  area: "",
  city: "Ηράκλειο",
  postalCode: "71201",
  countryCode: "gr",
  phone: "6941234567",
  ...over,
});

const cartAddress = {
  first_name: "Γιώργος",
  last_name: "Νικολάου",
  phone: "6977777777",
  address_1: "Κνωσού 12",
  address_2: null,
  city: "Ηράκλειο",
  postal_code: "71306",
};

describe("buildCheckoutPrefill", () => {
  it("starts empty for a guest with an empty cart", () => {
    const p = buildCheckoutPrefill({ cartEmail: undefined, cartShipping: null, cartBilling: null, customer: null, savedAddresses: [] });
    expect(p.email).toBe("");
    expect(p.details.street).toBe("");
    expect(p.detailsNeedSave).toBe(false);
    expect(p.emailNeedsSave).toBe(false);
    expect(p.profile).toBeNull();
  });

  it("restores the cart's own address first — a refresh no longer empties the form", () => {
    const p = buildCheckoutPrefill({
      cartEmail: "guest@example.com",
      cartShipping: cartAddress,
      cartBilling: cartAddress,
      customer,
      savedAddresses: [saved()],
    });
    expect(p.email).toBe("guest@example.com");
    expect(p.details).toMatchObject({ firstName: "Γιώργος", street: "Κνωσού", number: "12", postalCode: "71306" });
    // Already on the cart: nothing to save, and billing isn't "different".
    expect(p.detailsNeedSave).toBe(false);
    expect(p.emailNeedsSave).toBe(false);
    expect(p.billing).toBeNull();
    // Not one of the saved addresses → the picker shows "Νέα διεύθυνση".
    expect(p.savedAddressId).toBeNull();
  });

  it("restores a billing address only when it genuinely differs", () => {
    const p = buildCheckoutPrefill({
      cartEmail: "guest@example.com",
      cartShipping: cartAddress,
      cartBilling: { ...cartAddress, address_1: "Έβανς 5", postal_code: "71202" },
      customer: null,
      savedAddresses: [],
    });
    expect(p.billing).toEqual({ street: "Έβανς", number: "5", area: "", postalCode: "71202", city: "Ηράκλειο" });
  });

  it("recognises the cart's address as a saved one", () => {
    const p = buildCheckoutPrefill({
      cartEmail: "maria@example.com",
      cartShipping: { ...cartAddress, address_1: "Ικάρου 25", postal_code: "712 01" },
      cartBilling: null,
      customer,
      savedAddresses: [saved()],
    });
    expect(p.savedAddressId).toBe("a1");
  });

  it("fills a signed-in customer's first saved address and asks to save it", () => {
    const p = buildCheckoutPrefill({
      cartEmail: undefined,
      cartShipping: null,
      cartBilling: null,
      customer,
      savedAddresses: [saved(), saved({ id: "a2", street: "Κνωσού", number: "12" })],
    });
    expect(p.email).toBe("maria@example.com");
    expect(p.emailNeedsSave).toBe(true);
    expect(p.details).toMatchObject({ street: "Ικάρου", number: "25", city: "Ηράκλειο", phone: "6941234567" });
    expect(p.detailsNeedSave).toBe(true);
    expect(p.savedAddressId).toBe("a1");
  });

  it("keeps an email already typed on the cart over the account's", () => {
    const p = buildCheckoutPrefill({ cartEmail: "other@example.com", cartShipping: null, cartBilling: null, customer, savedAddresses: [] });
    expect(p.email).toBe("other@example.com");
    expect(p.emailNeedsSave).toBe(false);
  });

  it("fills only name and phone for a signed-in customer with no saved address", () => {
    const p = buildCheckoutPrefill({ cartEmail: undefined, cartShipping: null, cartBilling: null, customer, savedAddresses: [] });
    expect(p.details).toMatchObject({ firstName: "Μαρία", lastName: "Παπαδάκη", phone: "6941234567", street: "" });
    expect(p.detailsNeedSave).toBe(false);
  });
});

describe("detailsFromSavedAddress", () => {
  it("falls back to the profile for a saved address without name or phone", () => {
    const d = detailsFromSavedAddress(saved({ firstName: "", lastName: "", phone: "" }), {
      firstName: "Μαρία",
      lastName: "Παπαδάκη",
      phone: "6941234567",
    });
    expect(d).toMatchObject({ firstName: "Μαρία", lastName: "Παπαδάκη", phone: "6941234567" });
  });
});

describe("findSavedAddress", () => {
  it("matches regardless of how street and number were split", () => {
    expect(findSavedAddress({ street: "Ικάρου 25", number: "", postalCode: "712 01" }, [saved()])?.id).toBe("a1");
    expect(findSavedAddress({ street: "Ικάρου", number: "27", postalCode: "71201" }, [saved()])).toBeUndefined();
  });
});
