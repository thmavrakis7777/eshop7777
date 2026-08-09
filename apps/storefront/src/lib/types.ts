// Shaped to line up with Medusa's product/category response objects,
// so the Phase 2 swap to real data is an adapter change, not a UI rewrite.

export type Tone = "clay" | "sage" | "stone" | "linen";

export type Money = {
  amount: number; // in whole euros for the mock layer (Medusa uses minor units)
  currencyCode: "EUR";
};

export type Category = {
  id: string;
  name: string;
  handle: string;
  parentHandle?: string;
  description?: string;
};

export type ProductVariant = {
  id: string;
  title: string;
  price: Money;
  inventoryQuantity: number;
  // Medusa's variant SKU — the permanent, unique product/reference code.
  // Stable across title/category/price/image/description edits since it's
  // its own DB column, and uniqueness is enforced by Medusa itself. See
  // PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md §1.1.
  code: string | null;
  // Derived once in the data layer (see isVariantAvailable in
  // lib/data/products.ts) so every consumer (ProductCard, PDP) checks the
  // same rule instead of re-deriving it and risking drift.
  isAvailable: boolean;
};

// Medusa's native product attribute fields, mapped through only when
// populated — see lib/data/products.ts's toDomainCharacteristics. `null`
// (not an object with undefined fields) when nothing is entered, so
// callers can render the whole section conditionally with one check
// instead of testing each field.
export type ProductCharacteristics = {
  material?: string;
  weightGrams?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  originCountry?: string;
};

export type Product = {
  id: string;
  title: string;
  handle: string;
  categoryHandle: string;
  shortDescription: string;
  price: Money;
  compareAtPrice?: Money;
  // No review system exists yet — real products carry no rating. Never
  // fabricate one; a fake trust signal is worse than showing none.
  rating?: number;
  reviewCount?: number;
  badges?: Array<"new" | "sale">;
  variants: ProductVariant[];
  placeholderTone: Tone;
  // The default (first) variant's code — convenience for single-variant
  // display (100% of the catalog today) so callers don't need to reach
  // into `variants[0]` just to show a product code.
  code: string | null;
  // True if at least one variant is purchasable.
  isAvailable: boolean;
  characteristics: ProductCharacteristics | null;
};

export type NavCategory = Category & {
  children: Category[];
  featured?: { title: string; ctaLabel: string; href: string };
};

export type CartLineItem = {
  id: string;
  productHandle: string;
  title: string;
  quantity: number;
  unitPrice: Money;
  compareAtUnitPrice?: Money;
  lineTotal: Money;
  placeholderTone: Tone;
};

export type AppliedPromotion = {
  code: string;
  // Percentage promotions (the only type this project has tested/seeded)
  // carry a human-readable value; other Medusa promotion types are passed
  // through without one rather than guessing a label.
  percentage?: number;
};

export type TaxDocumentType = "receipt" | "invoice";

// Επωνυμία/Δραστηριότητα can be autofilled from a ΓΕΜΗ lookup once ΑΦΜ
// passes its checksum (lib/actions/afm-lookup.ts); ΔΟΥ/Έδρα always stay
// manual (ΓΕΜΗ has no ΔΟΥ field, Έδρα reuses the billing address instead).
// ΑΦΜ itself is validated client-side (checksum only, see
// lib/checkout-validation.ts's isValidAFM).
export type InvoiceDetails = {
  companyName: string;
  afm: string;
  doy: string;
  activity: string;
};

export type Cart = {
  id: string;
  // Carried through so order completion can resolve the cart's payment
  // providers without a second round-trip just to read region_id back.
  regionId: string;
  email?: string;
  items: CartLineItem[];
  itemCount: number;
  // Items only, pre-discount — see PROJECT_MEMORY.md "Cart architecture" for
  // why this is mapped from Medusa's `item_subtotal`, not `subtotal` (the
  // latter silently includes shipping once a shipping method is set).
  subtotal: Money;
  discountTotal: Money;
  shippingTotal: Money;
  hasShippingMethod: boolean;
  total: Money;
  promotions: AppliedPromotion[];
  shippingAddress?: AddressSummary;
  billingAddress?: AddressSummary;
  // Defaults to "receipt" (Απόδειξη) — matches CHECKOUT_PREMIUM_SPEC.md §4's
  // default, and a cart with no tax-document metadata yet (every cart
  // created before this phase) should read as the same honest default
  // rather than an undefined/invalid state.
  taxDocumentType: TaxDocumentType;
  invoiceDetails?: InvoiceDetails;
};

// The checkout form's own shape (street/number split, matching the Greek
// address form) — deliberately not the same shape used for *displaying* a
// saved address (see AddressSummary below), since Medusa's `address_1` is a
// single string and splitting it back apart isn't reliably reversible.
export type Address = {
  firstName: string;
  lastName: string;
  street: string;
  number: string;
  area?: string;
  city: string;
  postalCode: string;
  countryCode: string;
  phone: string;
};

// A saved/returned address as Medusa actually stores it — for display only
// (order confirmation, review), not for re-populating the form.
export type AddressSummary = {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  phone?: string;
};

export type ShippingOption = {
  id: string;
  name: string;
  price: Money;
  deliveryEstimate?: string;
  // Derived from the shipping option type's `code` — see
  // lib/data/checkout.ts. Drives whether ShippingSection shows the
  // pickup-location info block instead of just a price row.
  isPickup: boolean;
};

export type PaymentProvider = {
  id: string;
};

export type OrderLineItem = {
  id: string;
  title: string;
  quantity: number;
  total: Money;
  placeholderTone: Tone;
};

export type Order = {
  id: string;
  displayId: number;
  email: string;
  items: OrderLineItem[];
  subtotal: Money;
  discountTotal: Money;
  shippingTotal: Money;
  total: Money;
  shippingMethodName?: string;
  shippingAddress?: AddressSummary;
  billingAddress?: AddressSummary;
  taxDocumentType: TaxDocumentType;
  invoiceDetails?: InvoiceDetails;
  createdAt: string;
};
