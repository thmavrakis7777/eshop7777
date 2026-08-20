import "server-only";
import { sql, type Tx } from "@/lib/db/client";
import { toneFor } from "@/lib/db/catalog";
import type { Cart, CartLineItem, Money } from "@/lib/types";

/**
 * The cart engine. Replaces Medusa's cart module, its line-item adjustments,
 * its promotion application methods, and the four tables behind them.
 *
 * Totals are computed here, in one place, from the cart's own rows — the
 * storefront never has to reconcile a `subtotal` that silently folds in
 * shipping (the exact Medusa quirk documented in the old lib/data/cart.ts,
 * where `subtotal` and `item_subtotal` meant different things).
 *
 * Money is VAT-INCLUSIVE integer cents throughout (Greek B2C law). `vatTotal`
 * is a derived breakdown line, never added on top.
 */

// Standard Greek ΦΠΑ. Overridable per-store in shop.site_setting and
// per-product via shop.product.vat_rate; both default to this.
const DEFAULT_VAT_RATE = 24;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards every cart-id lookup. Returning visitors can still be carrying a
 * `cart_id` cookie holding a *Medusa* id (`cart_01J…`), which is not a uuid —
 * passing it to Postgres raises `invalid input syntax for type uuid` rather
 * than simply finding nothing. Treated as "no cart", the same as an expired
 * one, so the migration is invisible to anyone mid-shop.
 */
export const isCartId = (id: string | undefined | null): id is string => Boolean(id && UUID_RE.test(id));

const eur = (cents: number): Money => ({ amount: cents / 100, currencyCode: "EUR" });

type CartRow = {
  id: string;
  customer_id: string | null;
  email: string | null;
  shipping_address: AddressJson | null;
  billing_address: AddressJson | null;
  tax_document_type: "receipt" | "invoice";
  invoice_company_name: string | null;
  invoice_afm: string | null;
  invoice_doy: string | null;
  invoice_activity: string | null;
  shipping_method_id: string | null;
  shipping_name: string | null;
  shipping_price_cents: number | null;
  shipping_free_over_cents: number | null;
  shipping_is_pickup: boolean | null;
  discount_code: string | null;
  discount_type: "percentage" | "fixed" | null;
  discount_value: number | null;
  discount_min_subtotal_cents: number | null;
  items: ItemRow[];
};

type ItemRow = {
  id: string;
  variant_id: string;
  quantity: number;
  title: string;
  sku: string | null;
  product_slug: string;
  unit_price_cents: number;
  compare_at_price_cents: number | null;
  // Joined live from the product, not frozen onto the line like price is:
  // if the owner corrects a shipping cost, open carts should reflect it.
  shipping_cost_cents: number | null;
};

export type AddressJson = {
  first_name?: string | null;
  last_name?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  phone?: string | null;
};

export function toAddressSummary(a: AddressJson) {
  return {
    fullName: [a.first_name, a.last_name].filter(Boolean).join(" "),
    addressLine1: a.address_1 ?? "",
    addressLine2: a.address_2 ?? undefined,
    city: a.city ?? "",
    postalCode: a.postal_code ?? "",
    phone: a.phone ?? undefined,
  };
}

/**
 * The single money calculation for a cart. Exported because order completion
 * must produce byte-identical figures — the customer is charged what the
 * cart showed, so there is exactly one implementation of this arithmetic.
 */
export function computeTotals(input: {
  items: Array<{
    unit_price_cents: number;
    quantity: number;
    /** Per-product override. NULL/0 = ships under the standard method. */
    shipping_cost_cents?: number | null;
  }>;
  discount: { type: "percentage" | "fixed"; value: number; min_subtotal_cents: number } | null;
  shipping: { price_cents: number; free_over_cents: number | null; is_pickup: boolean } | null;
  vatRate?: number;
}) {
  const subtotalCents = input.items.reduce((sum, i) => sum + i.unit_price_cents * i.quantity, 0);

  let discountCents = 0;
  if (input.discount && subtotalCents >= input.discount.min_subtotal_cents) {
    discountCents =
      input.discount.type === "percentage"
        ? Math.round((subtotalCents * input.discount.value) / 100)
        : input.discount.value;
    // Never discount below zero, and never turn a discount into a refund.
    discountCents = Math.min(discountCents, subtotalCents);
  }

  const afterDiscount = subtotalCents - discountCents;

  // Shipping. Two regimes, never mixed:
  //
  //   * All-standard cart  → the chosen method's price, once, waived above
  //     the free-shipping threshold.
  //   * Any oversized item → each oversized LINE pays its own cost × its
  //     quantity (two bathtubs are two parcels), and standard items in the
  //     same cart ride along free rather than adding the method price on top.
  //
  // So 1 normal = 3.50, 1 heavy + 1 normal = 8.00, 2 heavy + 1 normal = 16.00.
  // The last case is why this is not "the single highest cost wins".
  //
  // The free-shipping threshold deliberately does NOT waive oversized costs:
  // those exist because the parcel genuinely costs more to send, and a large
  // order does not make a bathtub cheaper to ship. Store pickup skips all of
  // it, oversized included — nothing is being sent.
  let shippingCents = 0;
  if (input.shipping && !input.shipping.is_pickup) {
    const oversizedCents = input.items.reduce(
      (sum, i) => sum + Math.max(0, i.shipping_cost_cents ?? 0) * i.quantity,
      0
    );

    if (oversizedCents > 0) {
      shippingCents = oversizedCents;
    } else {
      const qualifiesFree =
        input.shipping.free_over_cents != null && afterDiscount >= input.shipping.free_over_cents;
      shippingCents = qualifiesFree ? 0 : input.shipping.price_cents;
    }
  }

  const totalCents = afterDiscount + shippingCents;

  // Prices already include VAT, so this extracts the embedded tax rather than
  // adding to it: gross × rate ÷ (100 + rate).
  const rate = input.vatRate ?? DEFAULT_VAT_RATE;
  const vatCents = Math.round((totalCents * rate) / (100 + rate));

  return { subtotalCents, discountCents, shippingCents, totalCents, vatCents, vatRate: rate };
}

// One query for the whole cart: header, joined shipping method and discount,
// plus items as an aggregated JSON array. The Medusa version needed a `fields`
// string listing every relation to expand.
const cartQuery = (id: string) => sql<CartRow[]>`
  SELECT c.id, c.customer_id, c.email,
         c.shipping_address, c.billing_address,
         c.tax_document_type, c.invoice_company_name, c.invoice_afm,
         c.invoice_doy, c.invoice_activity,
         c.shipping_method_id,
         sm.name AS shipping_name, sm.price_cents AS shipping_price_cents,
         sm.free_over_cents AS shipping_free_over_cents, sm.is_pickup AS shipping_is_pickup,
         d.code AS discount_code, d.type AS discount_type, d.value AS discount_value,
         d.min_subtotal_cents AS discount_min_subtotal_cents,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', i.id, 'variant_id', i.variant_id, 'quantity', i.quantity,
             'title', i.title, 'sku', i.sku, 'product_slug', i.product_slug,
             'unit_price_cents', i.unit_price_cents,
             'compare_at_price_cents', i.compare_at_price_cents,
             'shipping_cost_cents', p.shipping_cost_cents
           ) ORDER BY i.created_at)
           FROM shop.cart_item i
           LEFT JOIN shop.product_variant v ON v.id = i.variant_id
           LEFT JOIN shop.product p ON p.id = v.product_id
          WHERE i.cart_id = c.id
         ), '[]'::json) AS items
    FROM shop.cart c
    LEFT JOIN shop.shipping_method sm ON sm.id = c.shipping_method_id
    LEFT JOIN shop.discount d ON d.id = c.discount_id
   WHERE c.id = ${id} AND c.status = 'active'
   LIMIT 1`;

function toDomainCart(r: CartRow): Cart {
  const items: CartLineItem[] = r.items.map((i) => ({
    id: i.id,
    productHandle: i.product_slug,
    title: i.title,
    quantity: i.quantity,
    code: i.sku,
    unitPrice: eur(i.unit_price_cents),
    compareAtUnitPrice:
      i.compare_at_price_cents && i.compare_at_price_cents > i.unit_price_cents
        ? eur(i.compare_at_price_cents)
        : undefined,
    lineTotal: eur(i.unit_price_cents * i.quantity),
    placeholderTone: toneFor(i.product_slug),
    hasExtraShipping: (i.shipping_cost_cents ?? 0) > 0,
  }));

  const totals = computeTotals({
    items: r.items,
    discount:
      r.discount_type && r.discount_value != null
        ? {
            type: r.discount_type,
            value: r.discount_value,
            min_subtotal_cents: r.discount_min_subtotal_cents ?? 0,
          }
        : null,
    shipping:
      r.shipping_price_cents != null
        ? {
            price_cents: r.shipping_price_cents,
            free_over_cents: r.shipping_free_over_cents,
            is_pickup: r.shipping_is_pickup ?? false,
          }
        : null,
  });

  return {
    id: r.id,
    email: r.email ?? undefined,
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: eur(totals.subtotalCents),
    discountTotal: eur(totals.discountCents),
    shippingTotal: eur(totals.shippingCents),
    vatTotal: eur(totals.vatCents),
    vatRate: totals.vatRate,
    hasShippingMethod: r.shipping_price_cents != null,
    shippingMethodId: r.shipping_method_id ?? undefined,
    total: eur(totals.totalCents),
    // One discount per cart. Medusa allowed a list; a second code now replaces
    // the first rather than stacking, which is what a single-discount store
    // actually wants and removes a whole class of "which order do they apply
    // in" ambiguity. The domain type stays an array so the UI is unchanged.
    promotions:
      r.discount_code && r.discount_type
        ? [
            {
              code: r.discount_code,
              percentage: r.discount_type === "percentage" ? (r.discount_value ?? undefined) : undefined,
            },
          ]
        : [],
    shippingAddress: r.shipping_address ? toAddressSummary(r.shipping_address) : undefined,
    billingAddress: r.billing_address ? toAddressSummary(r.billing_address) : undefined,
    taxDocumentType: r.tax_document_type,
    ...(r.tax_document_type === "invoice" && (r.invoice_company_name || r.invoice_afm)
      ? {
          invoiceDetails: {
            companyName: r.invoice_company_name ?? "",
            afm: r.invoice_afm ?? "",
            doy: r.invoice_doy ?? "",
            activity: r.invoice_activity ?? "",
          },
        }
      : {}),
  };
}

/** Read-only, never throws — called from RootLayout on every page. */
export async function getCartById(cartId: string | undefined | null): Promise<Cart | null> {
  if (!isCartId(cartId)) return null;
  try {
    const rows = await cartQuery(cartId);
    return rows[0] ? toDomainCart(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function createCart(customerId?: string | null): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO shop.cart (customer_id) VALUES (${customerId ?? null}) RETURNING id`;
  return row.id;
}

/** Errors the actions layer maps to the Greek copy table in CART_UX_SPEC §14. */
export class CartError extends Error {
  constructor(message: string, public readonly code: CartErrorCode) {
    super(message);
  }
}
export type CartErrorCode =
  | "insufficient_inventory"
  | "not_found"
  | "invalid_code"
  | "expired_code"
  | "min_subtotal";

/**
 * Adds a variant to the cart, or increases the quantity if it is already
 * there (the unique index on (cart_id, variant_id) makes that an upsert
 * rather than a read-then-write race).
 *
 * Price and title are snapshotted from the live variant at add time — the
 * cart shows what the customer saw. Order completion re-prices from the
 * variant again, so a stale snapshot can never be what is charged.
 */
export async function addItem(cartId: string, variantId: string, quantity: number): Promise<void> {
  await sql.begin(async (tx: Tx) => {
    const [v] = await tx<
      {
        id: string;
        sku: string;
        price_cents: number;
        compare_at_price_cents: number | null;
        stock_quantity: number;
        allow_backorder: boolean;
        title: string;
        variant_title: string;
        slug: string;
      }[]
    >`SELECT v.id, v.sku, v.price_cents, v.compare_at_price_cents,
             v.stock_quantity, v.allow_backorder, v.title AS variant_title,
             p.title, p.slug
        FROM shop.product_variant v
        JOIN shop.product p ON p.id = v.product_id
       WHERE v.id = ${variantId} AND v.is_active AND p.is_active`;

    if (!v) throw new CartError("Variant not found", "not_found");

    const [existing] = await tx<{ quantity: number }[]>`
      SELECT quantity FROM shop.cart_item WHERE cart_id = ${cartId} AND variant_id = ${variantId}`;
    const desired = (existing?.quantity ?? 0) + quantity;

    if (!v.allow_backorder && desired > v.stock_quantity) {
      throw new CartError("Not enough stock", "insufficient_inventory");
    }

    await tx`
      INSERT INTO shop.cart_item (
        cart_id, variant_id, quantity, title, sku, product_slug,
        unit_price_cents, compare_at_price_cents)
      VALUES (
        ${cartId}, ${variantId}, ${quantity}, ${v.title}, ${v.sku}, ${v.slug},
        ${v.price_cents}, ${v.compare_at_price_cents})
      ON CONFLICT (cart_id, variant_id) DO UPDATE SET
        quantity = shop.cart_item.quantity + EXCLUDED.quantity,
        unit_price_cents = EXCLUDED.unit_price_cents,
        compare_at_price_cents = EXCLUDED.compare_at_price_cents`;

    await touch(tx, cartId);
  });
}

export async function updateItemQuantity(cartId: string, itemId: string, quantity: number): Promise<void> {
  if (quantity <= 0) return removeItem(cartId, itemId);

  await sql.begin(async (tx: Tx) => {
    const [row] = await tx<{ stock_quantity: number; allow_backorder: boolean }[]>`
      SELECT v.stock_quantity, v.allow_backorder
        FROM shop.cart_item i JOIN shop.product_variant v ON v.id = i.variant_id
       WHERE i.id = ${itemId} AND i.cart_id = ${cartId}`;

    if (!row) throw new CartError("Line item not found", "not_found");
    if (!row.allow_backorder && quantity > row.stock_quantity) {
      throw new CartError("Not enough stock", "insufficient_inventory");
    }

    await tx`UPDATE shop.cart_item SET quantity = ${quantity} WHERE id = ${itemId} AND cart_id = ${cartId}`;
    await touch(tx, cartId);
  });
}

export async function removeItem(cartId: string, itemId: string): Promise<void> {
  await sql`DELETE FROM shop.cart_item WHERE id = ${itemId} AND cart_id = ${cartId}`;
  await touch(sql, cartId);
}

/**
 * Validates and applies a discount code. Every rule that could reject a code
 * is checked here rather than trusted from a stored flag: active, within its
 * date window, under its redemption cap, and above its minimum subtotal.
 */
export async function applyDiscount(cartId: string, code: string): Promise<void> {
  const [d] = await sql<
    {
      id: string;
      min_subtotal_cents: number;
      is_active: boolean;
      starts_at: Date | null;
      ends_at: Date | null;
      max_redemptions: number | null;
      redemption_count: number;
    }[]
  >`SELECT id, min_subtotal_cents, is_active, starts_at, ends_at,
           max_redemptions, redemption_count
      FROM shop.discount WHERE lower(code) = lower(${code.trim()})`;

  if (!d || !d.is_active) throw new CartError("Unknown code", "invalid_code");

  const now = Date.now();
  if (d.starts_at && new Date(d.starts_at).getTime() > now) throw new CartError("Not started", "invalid_code");
  if (d.ends_at && new Date(d.ends_at).getTime() < now) throw new CartError("Expired", "expired_code");
  if (d.max_redemptions != null && d.redemption_count >= d.max_redemptions) {
    throw new CartError("Fully redeemed", "expired_code");
  }

  const [{ subtotal }] = await sql<{ subtotal: number }[]>`
    SELECT COALESCE(SUM(unit_price_cents * quantity), 0)::int AS subtotal
      FROM shop.cart_item WHERE cart_id = ${cartId}`;
  if (subtotal < d.min_subtotal_cents) throw new CartError("Below minimum", "min_subtotal");

  await sql`UPDATE shop.cart SET discount_id = ${d.id} WHERE id = ${cartId}`;
}

/**
 * Clears the cart's discount. The code is checked against what is actually
 * applied: a stale tab showing an older code must not be able to remove a
 * newer one the customer has since entered.
 */
export async function removeDiscount(cartId: string, code?: string): Promise<void> {
  if (!code) {
    await sql`UPDATE shop.cart SET discount_id = NULL WHERE id = ${cartId}`;
    return;
  }
  await sql`
    UPDATE shop.cart c SET discount_id = NULL
      FROM shop.discount d
     WHERE c.id = ${cartId} AND d.id = c.discount_id AND lower(d.code) = lower(${code.trim()})`;
}

export async function setCartEmail(cartId: string, email: string): Promise<void> {
  await sql`UPDATE shop.cart SET email = ${email} WHERE id = ${cartId}`;
}

export async function setCartAddresses(
  cartId: string,
  shipping: AddressJson,
  billing: AddressJson
): Promise<void> {
  await sql`
    UPDATE shop.cart
       SET shipping_address = ${sql.json(shipping)}, billing_address = ${sql.json(billing)}
     WHERE id = ${cartId}`;
}

export async function setShippingMethod(cartId: string, methodId: string): Promise<void> {
  const [m] = await sql<{ id: string }[]>`
    SELECT id FROM shop.shipping_method WHERE id = ${methodId} AND is_active`;
  if (!m) throw new CartError("Unknown shipping method", "not_found");
  await sql`UPDATE shop.cart SET shipping_method_id = ${methodId} WHERE id = ${cartId}`;
}

/**
 * Tax document details. These are real typed columns now; under Medusa they
 * were smuggled through `cart.metadata`, which meant switching back to
 * "receipt" had to send explicit nulls because a metadata POST merged rather
 * than replaced — a real bug that class of storage invited. A plain UPDATE
 * cannot have that problem.
 */
export async function setTaxDocument(
  cartId: string,
  details:
    | { type: "receipt" }
    | { type: "invoice"; companyName: string; afm: string; doy: string; activity: string }
): Promise<void> {
  if (details.type === "receipt") {
    await sql`
      UPDATE shop.cart
         SET tax_document_type = 'receipt', invoice_company_name = NULL,
             invoice_afm = NULL, invoice_doy = NULL, invoice_activity = NULL
       WHERE id = ${cartId}`;
    return;
  }
  await sql`
    UPDATE shop.cart
       SET tax_document_type = 'invoice',
           invoice_company_name = ${details.companyName},
           invoice_afm = ${details.afm},
           invoice_doy = ${details.doy},
           invoice_activity = ${details.activity}
     WHERE id = ${cartId}`;
}

// Keeps `updated_at` honest when only child rows changed, so abandoned-cart
// reporting later measures real inactivity rather than cart creation time.
async function touch(conn: typeof sql | Tx, cartId: string): Promise<void> {
  await conn`UPDATE shop.cart SET updated_at = now() WHERE id = ${cartId}`;
}
