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
  // Mobile drill-down menu's "view all products in this category" link
  // (shop.category_view_all_button). Optional like the fields above —
  // populated with real defaults already applied (see toCategory()) by
  // every category fetched through fetchAllCategories(), omitted wherever
  // a Category is constructed for a context that never reads it. Separate
  // from NavCategory's `promo` (desktop mega-menu panel) on purpose —
  // independent feature, independent table, never merged.
  mobileViewAllButton?: { enabled: boolean; text: string; position: "top" | "bottom" };
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
  // Raw backorder flag behind `isAvailable` — the Product Page's quantity
  // selector needs this directly (not just the yes/no `isAvailable`) to know
  // whether `inventoryQuantity` is a real ceiling or unlimited. See
  // lib/stock.ts's isQuantityAvailable, the single rule this and the
  // server-side cart mutations both implement.
  allowBackorder: boolean;
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
  // The canonical parent_id tree only — this is what URL routing, the
  // sitemap, and breadcrumbs walk. Never contains a cross-listed entry: a
  // category is reachable at exactly one URL, so nothing outside this field
  // may ever double as a route source.
  children: CategoryNode[];
  productCount: number;
  // Always this node's own canonical URL (built from its primary-parent
  // ancestor chain), computed once when the tree is assembled. Every
  // renderer should link to a category via this field rather than
  // concatenating a parent's handle with this node's own handle — that
  // concatenation is only correct for a primary child, and silently wrong
  // for a cross-listed one.
  canonicalHref: string;
  // Presentation-only: this node's canonical `children` PLUS any category
  // that lists this node as a secondary parent (shop.category_secondary_
  // parent) — used by navigation/mega-menu/category-page "shop by type"
  // rendering so a cross-listed category shows up everywhere it's
  // configured to, without ever feeding back into `children`/routing.
  displayChildren: CategoryNode[];
};

export type NavCategory = CategoryNode & {
  // Dashboard-managed mega-menu promotional tile — undefined when the
  // category has no enabled promo configured (shop.category_promo).
  promo?: {
    imagePath: string | null;
    title: string | null;
    description: string | null;
    buttonText: string;
    href: string;
  };
};

export type CartLineItem = {
  id: string;
  variantId: string;
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
  // The raw per-product oversized cost behind hasExtraShipping (null/0 for a
  // standard item) — checkout's ShippingSection needs the actual number, not
  // just the yes/no flag, to preview the real charge for each shipping
  // option (see lib/shipping.ts's highestOversizedFeeCents, the same
  // function computeTotals itself uses for the actual charge).
  shippingCostCents: number | null;
  // Live variant stock (joined fresh on every cart read, never snapshotted —
  // same rationale as shipping_cost_cents above), for the global stock-limit
  // feature: lets the Cart Page/Mini-Cart/Checkout detect a line that was
  // valid when added but exceeds stock now (see lib/stock.ts).
  stockQuantity: number;
  allowBackorder: boolean;
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
  // Cart subtotal (after discount) above which THIS option becomes free, in
  // euro cents — null means it's never conditionally free. Carried through
  // so ShippingSection can show "X€ away from free shipping" without a
  // second round trip; it is not itself the eligibility check (the server
  // already only returns options the address actually qualifies for).
  freeOverCents: number | null;
  // True for the Heraklion-only method. Its free-shipping threshold covers
  // the whole order, heavy/bulky items included — the one exception to "an
  // oversized line always charges its own real cost" (see ShippingSection).
  heraklionOnly: boolean;
};

export type PaymentProvider = {
  // Stable code the order stores and completion validates against — not a
  // vendor id (there's no vendor): "cod" | "bank_transfer" today.
  id: string;
  name: string;
  description: string | null;
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
  loyaltyReward?: { code: string; endsAt: string | null };
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
