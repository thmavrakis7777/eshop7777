// Shared shape for the "Στοιχεία παραλήπτη" + "Διεύθυνση παράδοσης"
// sections — two visual sections, but they save together as Medusa's
// single `shipping_address` object (lib/actions/checkout.ts), so their
// form state lives together too rather than being artificially split.
export type ContactAddressFields = {
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  number: string;
  area: string;
  postalCode: string;
  city: string;
};

export const EMPTY_CONTACT_ADDRESS: ContactAddressFields = {
  firstName: "",
  lastName: "",
  phone: "",
  street: "",
  number: "",
  area: "",
  postalCode: "",
  city: "",
};

export type ContactAddressErrors = Partial<Record<keyof ContactAddressFields, string>>;

// Same address shape as ContactAddressFields' address half, kept as its own
// type (not reused directly) because it's a genuinely separate Medusa
// object (billing_address, not shipping_address) with its own toggle/reveal
// lifecycle — see BillingAddressSection.tsx.
export type BillingAddressFields = {
  street: string;
  number: string;
  area: string;
  postalCode: string;
  city: string;
};

export const EMPTY_BILLING_ADDRESS: BillingAddressFields = {
  street: "",
  number: "",
  area: "",
  postalCode: "",
  city: "",
};

export type BillingAddressErrors = Partial<Record<keyof BillingAddressFields, string>>;

export function validateAddressFields<T extends { street: string; number: string; postalCode: string; city: string }>(
  fields: T
): Partial<Record<"street" | "number" | "postalCode" | "city", string>> {
  const errors: Partial<Record<"street" | "number" | "postalCode" | "city", string>> = {};
  if (!fields.street.trim()) errors.street = "Συμπλήρωσε αυτό το πεδίο.";
  if (!fields.number.trim()) errors.number = "Συμπλήρωσε αυτό το πεδίο.";
  if (!/^\d{5}$/.test(fields.postalCode.trim())) errors.postalCode = "Ο ταχυδρομικός κώδικας δεν είναι έγκυρος.";
  if (!fields.city.trim()) errors.city = "Συμπλήρωσε αυτό το πεδίο.";
  return errors;
}

export type InvoiceFormFields = {
  companyName: string;
  afm: string;
  doy: string;
  activity: string;
};

export const EMPTY_INVOICE_FIELDS: InvoiceFormFields = {
  companyName: "",
  afm: "",
  doy: "",
  activity: "",
};

export type InvoiceFormErrors = Partial<Record<keyof InvoiceFormFields, string>>;
