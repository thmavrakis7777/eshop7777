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

export type Cart = {
  id: string;
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
  createdAt: string;
};
