const MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

export type MedusaCategory = {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  parent_category_id: string | null;
};

export type MedusaCalculatedPrice = {
  calculated_amount: number | null;
  original_amount: number | null;
  currency_code: string;
} | null;

export type MedusaVariant = {
  id: string;
  title: string;
  sku: string | null;
  calculated_price: MedusaCalculatedPrice;
};

export type MedusaImage = { id: string; url: string };

export type MedusaProduct = {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  thumbnail: string | null;
  images: MedusaImage[];
  variants: MedusaVariant[];
  categories: Array<{ id: string; name: string; handle: string }>;
  created_at: string;
  status: string;
};

export type MedusaRegion = { id: string; name: string; currency_code: string };

export type MedusaLineItemAdjustment = { code: string; amount: number };

export type MedusaLineItem = {
  id: string;
  product_handle: string;
  title: string;
  thumbnail: string | null;
  quantity: number;
  unit_price: number;
  compare_at_unit_price: number | null;
  adjustments: MedusaLineItemAdjustment[];
};

export type MedusaPromotion = {
  id: string;
  code: string;
  application_method: { type: string; value: number } | null;
};

export type MedusaCart = {
  id: string;
  email: string | null;
  region_id: string;
  items: MedusaLineItem[];
  // `subtotal` is NOT items-only — confirmed live, it's item_subtotal +
  // shipping_total (pre-tax). Use `item_subtotal` for an items-only figure
  // (the cart/checkout UI's "Υποσύνολο" row) — see PROJECT_MEMORY.md "Cart
  // architecture" for the full reconciliation against `total`.
  subtotal: number;
  item_subtotal: number;
  discount_total: number;
  shipping_total: number;
  total: number;
  shipping_address: MedusaAddress | null;
  shipping_methods: Array<{ id: string; name: string; amount: number }>;
  // Can contain `null` for a promotion that was deleted/deactivated while
  // still applied to this cart — confirmed live, not a hypothetical.
  promotions: (MedusaPromotion | null)[];
};

export type MedusaAddress = {
  first_name: string | null;
  last_name: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  province: string | null;
  phone: string | null;
};

export type MedusaShippingOption = {
  id: string;
  name: string;
  amount: number;
  // `type.code` is real, stable backend content ("standard"/"express") —
  // `type.description` also exists but only in English ("Ship in 2-3
  // days."), so the storefront translates by code rather than rendering
  // untranslated English or fabricating a claim the data doesn't back.
  type: { code: string } | null;
};

export type MedusaPaymentProvider = {
  id: string;
  is_enabled: boolean;
};

export type MedusaOrderLineItem = {
  id: string;
  title: string;
  thumbnail: string | null;
  quantity: number;
  unit_price: number;
  total: number;
};

export type MedusaOrder = {
  id: string;
  display_id: number;
  email: string | null;
  total: number;
  item_subtotal: number;
  discount_total: number;
  shipping_total: number;
  currency_code: string;
  created_at: string;
  items: MedusaOrderLineItem[];
  shipping_address: MedusaAddress | null;
  shipping_methods: Array<{ id: string; name: string; amount: number }>;
};

// Medusa's `/store/carts/:id/complete` returns a discriminated union: a
// successful completion produces the order; a workflow-level failure (e.g.
// stock disappeared between checkout and submission) returns the cart back
// with an `error` describing what went wrong — not a thrown HTTP error.
// Confirmed the success shape live; the failure shape is coded defensively
// against Medusa's documented contract (not force-triggered live — see
// CHECKOUT_UX_SPEC.md for what was and wasn't verified).
export type MedusaCartCompleteResponse =
  | { type: "order"; order: MedusaOrder }
  | { type: "cart"; cart: MedusaCart; error?: { message?: string } };

// Medusa's known error shapes for cart mutations — narrower than `Error`
// so callers can map specific failures to the Greek copy table in
// CART_UX_SPEC.md §14 instead of showing a generic message for everything.
export class MedusaApiError extends Error {
  constructor(
    message: string,
    public readonly code: string | undefined,
    public readonly type: string | undefined,
    public readonly status: number
  ) {
    super(message);
  }
}

type FetchOptions = RequestInit & { next?: { revalidate?: number | false; tags?: string[] } };

export class MedusaConfigError extends Error {}

/**
 * Thin fetch wrapper for Medusa's Store API. Deliberately not the full
 * @medusajs/js-sdk client — we only consume a handful of read endpoints,
 * and a plain typed fetch keeps the storefront's only server dependency
 * being "an HTTP API", not a specific SDK version lockstep with the backend.
 */
export async function medusaFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  if (!MEDUSA_PUBLISHABLE_KEY) {
    throw new MedusaConfigError(
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is not set. Copy it from the Medusa admin " +
        "(Settings > API Key Management > Publishable API Keys) into apps/storefront/.env.local."
    );
  }

  const res = await fetch(`${MEDUSA_BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const parsed = (() => {
      try {
        return JSON.parse(body) as { message?: string; code?: string; type?: string };
      } catch {
        return undefined;
      }
    })();
    throw new MedusaApiError(
      parsed?.message ?? `Medusa request failed: ${path} -> ${res.status} ${body}`.trim(),
      parsed?.code,
      parsed?.type,
      res.status
    );
  }

  return res.json() as Promise<T>;
}

// The store product list/detail endpoints require a region (or explicit
// country) to resolve `calculated_price` — there is no top-level
// `currency_code` query param on those endpoints. We only operate one
// region (Greece/EUR) today, so resolving "the" region is safe; this
// becomes a real lookup by country once multiple regions exist.
export async function getDefaultRegionId(): Promise<string> {
  const { regions } = await medusaFetch<{ regions: MedusaRegion[] }>(
    "/store/regions?limit=1",
    { next: { revalidate: 3600 } }
  );
  if (!regions[0]) {
    throw new Error("No Medusa region configured — create one in the admin first.");
  }
  return regions[0].id;
}
