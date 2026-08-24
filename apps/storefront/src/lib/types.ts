// Shaped to line up with Medusa's product/category response objects,
// so the Phase 2 swap to real data is an adapter change, not a UI rewrite.

export type Tone = "clay" | "sage" | "stone" | "linen";

export type Money = {
  amount: number; // in whole euros for the mock layer (Medusa uses minor units)
  currencyCode: "EUR";
};

export type FaqItem = { question: string; answer: string };

export type Category = {
  id: string;
  name: string;
  handle: string;
  parentHandle?: string;
  description?: string;
  // 'landing' categories render curated service-page content (hero copy,
  // FAQ, CTA) instead of a product grid — see migration 0010. Optional and
  // omitted wherever a category is fetched for nav/listing purposes only,
  // where it's never read.
  pageType?: "products" | "landing";
  imagePath?: string | null;
  faq?: FaqItem[] | null;
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
  // Set only when the product's active variants don't all share one price —
  // callers show "από {min.amount} €" instead of a single price when this
  // is present. Every real product today has exactly one variant, so this
  // is always undefined in practice until a second, differently-priced
  // variant exists — see toDomainProduct in lib/db/catalog.ts.
  priceRange?: { min: Money; max: Money };
  // No review system exists yet — real products carry no rating. Never
  // fabricate one; a fake trust signal is worse than showing none.
  rating?: number;
  reviewCount?: number;
  badges?: Array<"new" | "sale">;
  variants: ProductVariant[];
  placeholderTone: Tone;
  // Medusa's product thumbnail — null for every real product today (no
  // photography yet), in which case callers fall back to PlaceholderTile.
  imageUrl: string | null;
  // The default (first) variant's code — convenience for single-variant
  // display (100% of the catalog today) so callers don't need to reach
  // into `variants[0]` just to show a product code.
  code: string | null;
  // True if at least one variant is purchasable.
  isAvailable: boolean;
  characteristics: ProductCharacteristics | null;
};

/**
 * A category with its subtree attached. Recursive on purpose: the shop's
 * taxonomy is three levels deep today (main → sub → sub-sub) and the schema
 * allows more, so modelling "children" as a fixed one-level array would put
 * the depth limit in the types rather than in the data.
 *
 * `productCount` counts the category *and every active descendant*, matching
 * what its listing page actually shows — see getProductsByCategorySlug.
 */
export type CategoryNode = Category & {
  children: CategoryNode[];
  productCount: number;
};

export type NavCategory = CategoryNode & {
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
  imageUrl: string | null;
  // Snapshotted variant SKU, copied onto the line at order time so it stays
  // correct if the variant is later edited. (Pre-migration this pointed at
  // MedusaLineItem.variant_sku in lib/medusa.ts; that file no longer exists.)
  code: string | null;
  // true when this line carries its own oversized/heavy shipping surcharge
  // (shop.product.shipping_cost_cents), i.e. it is contributing to
  // `Cart.shippingTotal` on its own rather than via the flat shipping-method
  // price. Exists so the UI can explain *why* shipping costs more, not just
  // show the number — see CartTotals.tsx.
  hasExtraShipping: boolean;
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
  email?: string;
  items: CartLineItem[];
  itemCount: number;
  // Items only, pre-discount. Computed in lib/db/cart.ts from the cart's own
  // rows, so it means exactly one thing — unlike Medusa's `subtotal`, which
  // silently folded in shipping once a method was set and needed a separate
  // `item_subtotal` to get an items-only figure.
  subtotal: Money;
  discountTotal: Money;
  shippingTotal: Money;
  // ΦΠΑ already contained in `total`, broken out for display — Greek B2C
  // prices are VAT-inclusive by law, so this is never added on top.
  vatTotal: Money;
  vatRate: number;
  hasShippingMethod: boolean;
  // Which of getShippingOptionsForCart's rows is saved — lets the checkout
  // page pre-select the right radio on first render (e.g. after a refresh)
  // instead of only knowing a method is set once the user re-triggers a
  // save. Undefined exactly when hasShippingMethod is false.
  shippingMethodId?: string;
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
  variantTitle?: string;
  sku?: string;
  quantity: number;
  unitPrice: Money;
  total: Money;
  imageUrl?: string;
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
  // ΦΠΑ contained in `total`, recorded at the rate in force when the order
  // was placed — never recomputed from today's rate, so an old order still
  // reconciles against the invoice the customer received.
  vatTotal: Money;
  vatRate: number;
  total: Money;
  shippingMethodName?: string;
  shippingAddress?: AddressSummary;
  billingAddress?: AddressSummary;
  taxDocumentType: TaxDocumentType;
  invoiceDetails?: InvoiceDetails;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  courierName?: string;
  trackingCode?: string;
  trackingUrl?: string;
};

export type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

// A saved address book entry — the same field shape as the checkout
// form's `Address` (street/number split, Greek convention) plus its own id
// so it can be selected/edited/deleted, and an optional label since a
// customer can have more than one saved address.
export type CustomerAddress = Address & {
  id: string;
  label?: string;
  isDefaultShipping: boolean;
};
