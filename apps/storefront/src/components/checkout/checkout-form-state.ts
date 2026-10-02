import { isValidPostalCode } from "@/lib/checkout-validation";

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
  if (!fields.street.trim()) errors.street = "Παρακαλώ συμπληρώστε το πεδίο";
  if (!fields.number.trim()) errors.number = "Παρακαλώ συμπληρώστε το πεδίο";
  if (!fields.postalCode.trim()) errors.postalCode = "Παρακαλώ συμπληρώστε το πεδίο";
  else if (!isValidPostalCode(fields.postalCode)) errors.postalCode = "Ο ταχυδρομικός κώδικας δεν είναι έγκυρος.";
  if (!fields.city.trim()) errors.city = "Παρακαλώ συμπληρώστε το πεδίο";
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

// The invoice fields an ΑΦΜ lookup in ΑΑΔΕ's registry can fill.
export type RegistryFillFields = Pick<InvoiceFormFields, "companyName" | "doy" | "activity">;

const REGISTRY_FILL_KEYS: (keyof RegistryFillFields)[] = ["companyName", "doy", "activity"];

// Applies a registry lookup for a newly entered ΑΦΜ. A field is replaced
// when it's empty or still holds exactly what the previous lookup put there
// — so correcting a mistyped ΑΦΜ swaps the wrong company's details for the
// right one's, which only filling empty fields (the old rule) never did.
// Anything the customer typed or edited themselves is left alone. With no
// result (`next` null: lookup failed, or the ΑΦΜ isn't in the registry),
// the previous ΑΦΜ's details are cleared rather than left under a different
// ΑΦΜ.
export function applyRegistryFill(
  current: InvoiceFormFields,
  previousFill: RegistryFillFields | null,
  next: RegistryFillFields | null
): InvoiceFormFields {
  const result = { ...current };
  for (const key of REGISTRY_FILL_KEYS) {
    const stillOurs = current[key].trim() === "" || (previousFill !== null && current[key] === previousFill[key]);
    if (stillOurs) result[key] = next?.[key] ?? "";
  }
  return result;
}
