import { isSameAddressLine, splitStreetAndNumber } from "@/lib/address-format";
import {
  EMPTY_CONTACT_ADDRESS,
  type BillingAddressFields,
  type ContactAddressFields,
} from "@/components/checkout/checkout-form-state";
import type { Customer, CustomerAddress } from "@/lib/types";

// What the checkout form starts with (CHECKOUT_PREFILL_GOOGLE_SPEC.md §2.1).
// Plain functions, no server or browser APIs: the checkout page builds the
// starting values with them, and CheckoutForm reuses detailsFromSavedAddress
// when the customer picks another saved address.

// An address as the cart stores it (lib/db/cart.ts's AddressJson — restated
// structurally so this module never imports a server-only one).
type StoredAddress = {
  first_name?: string | null;
  last_name?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  phone?: string | null;
};

export type CheckoutProfile = { firstName: string; lastName: string; phone: string };

export type CheckoutPrefill = {
  email: string;
  // The email came from the account, not the cart — CheckoutForm saves it to
  // the cart straight away, as if the customer had typed it and moved on.
  emailNeedsSave: boolean;
  details: ContactAddressFields;
  // Same, for name/phone/address filled from a saved address. False when
  // they came from the cart, which already holds them.
  detailsNeedSave: boolean;
  // Only when the cart's billing address genuinely differs from its shipping
  // one — otherwise "different billing address" stays unticked, as always.
  billing: BillingAddressFields | null;
  // Which saved address the form shows, for the picker (§2.3). Null when it
  // shows none of them ("Νέα διεύθυνση").
  savedAddressId: string | null;
  // The signed-in customer's own name/phone — what a saved address without
  // them falls back to. Null for a guest.
  profile: CheckoutProfile | null;
};

function fromStored(a: StoredAddress): ContactAddressFields {
  const { street, number } = splitStreetAndNumber(a.address_1 ?? "");
  return {
    firstName: a.first_name ?? "",
    lastName: a.last_name ?? "",
    phone: a.phone ?? "",
    street,
    number,
    area: a.address_2 ?? "",
    postalCode: a.postal_code ?? "",
    city: a.city ?? "",
  };
}

function sameStoredAddress(a: StoredAddress, b: StoredAddress): boolean {
  return (
    isSameAddressLine(
      { line: a.address_1 ?? "", postalCode: a.postal_code ?? "" },
      { line: b.address_1 ?? "", postalCode: b.postal_code ?? "" }
    ) &&
    (a.city ?? "").trim() === (b.city ?? "").trim() &&
    (a.address_2 ?? "").trim() === (b.address_2 ?? "").trim()
  );
}

/** A saved address as checkout fields; name/phone fall back to the profile. */
export function detailsFromSavedAddress(address: CustomerAddress, profile: CheckoutProfile | null): ContactAddressFields {
  return {
    firstName: address.firstName || profile?.firstName || "",
    lastName: address.lastName || profile?.lastName || "",
    phone: address.phone || profile?.phone || "",
    street: address.street,
    number: address.number,
    area: address.area ?? "",
    postalCode: address.postalCode,
    city: address.city,
  };
}

/** Whether the form's current address is already in the address book (§2.4). */
export function findSavedAddress(
  details: Pick<ContactAddressFields, "street" | "number" | "postalCode">,
  savedAddresses: CustomerAddress[]
): CustomerAddress | undefined {
  const line = `${details.street} ${details.number}`;
  return savedAddresses.find((a) =>
    isSameAddressLine({ line, postalCode: details.postalCode }, { line: `${a.street} ${a.number}`, postalCode: a.postalCode })
  );
}

/**
 * Priority, highest first: the cart's own saved address (a refresh or a
 * return visit must never empty the form again), then a signed-in
 * customer's first saved address (the default sorts first), then their
 * profile's name and phone alone. Nothing known → empty, as before.
 */
export function buildCheckoutPrefill(input: {
  cartEmail: string | undefined;
  cartShipping: StoredAddress | null;
  cartBilling: StoredAddress | null;
  customer: Customer | null;
  savedAddresses: CustomerAddress[];
}): CheckoutPrefill {
  const { cartEmail, cartShipping, cartBilling, customer, savedAddresses } = input;
  const profile: CheckoutProfile | null = customer
    ? { firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone ?? "" }
    : null;
  const email = cartEmail || customer?.email || "";
  const emailNeedsSave = !cartEmail && Boolean(customer?.email);

  if (cartShipping?.address_1) {
    const details = fromStored(cartShipping);
    let billing: BillingAddressFields | null = null;
    if (cartBilling?.address_1 && !sameStoredAddress(cartShipping, cartBilling)) {
      const b = fromStored(cartBilling);
      billing = { street: b.street, number: b.number, area: b.area, postalCode: b.postalCode, city: b.city };
    }
    return {
      email,
      emailNeedsSave,
      details,
      detailsNeedSave: false,
      billing,
      savedAddressId: findSavedAddress(details, savedAddresses)?.id ?? null,
      profile,
    };
  }

  const firstSaved = savedAddresses[0];
  if (firstSaved) {
    return {
      email,
      emailNeedsSave,
      details: detailsFromSavedAddress(firstSaved, profile),
      detailsNeedSave: true,
      billing: null,
      savedAddressId: firstSaved.id,
      profile,
    };
  }

  return {
    email,
    emailNeedsSave,
    details: profile ? { ...EMPTY_CONTACT_ADDRESS, ...profile } : EMPTY_CONTACT_ADDRESS,
    detailsNeedSave: false,
    billing: null,
    savedAddressId: null,
    profile,
  };
}
