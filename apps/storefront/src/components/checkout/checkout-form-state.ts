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
