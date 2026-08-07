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
    throw new Error(`Medusa request failed: GET ${path} -> ${res.status} ${body}`.trim());
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
