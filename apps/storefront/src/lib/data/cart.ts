import { cookies } from "next/headers";
import { medusaFetch, MedusaApiError, type MedusaCart } from "@/lib/medusa";
import type { Cart, InvoiceDetails, TaxDocumentType } from "@/lib/types";
import { toneFor } from "@/lib/data/products";

export const CART_ID_COOKIE = "cart_id";

export const CART_FIELDS =
  "id,email,region_id,subtotal,item_subtotal,discount_total,shipping_total,total,metadata," +
  "*items,items.adjustments,*promotions,promotions.application_method," +
  "*shipping_address,*billing_address,*shipping_methods";

// Tax document type/ΑΦΜ details have no native Medusa field — stored in
// cart/order metadata under these keys (CHECKOUT_PREMIUM_SPEC.md §4). This
// is the one place that reads them back out, so the key names only need to
// be right here and in lib/actions/checkout.ts's write side.
export function parseTaxDocumentMetadata(
  metadata: Record<string, unknown> | null
): { taxDocumentType: TaxDocumentType; invoiceDetails?: InvoiceDetails } {
  const type = metadata?.tax_document_type === "invoice" ? "invoice" : "receipt";
  if (type !== "invoice") return { taxDocumentType: "receipt" };

  const companyName = typeof metadata?.invoice_company_name === "string" ? metadata.invoice_company_name : "";
  const afm = typeof metadata?.invoice_afm === "string" ? metadata.invoice_afm : "";
  const doy = typeof metadata?.invoice_doy === "string" ? metadata.invoice_doy : "";
  const activity = typeof metadata?.invoice_activity === "string" ? metadata.invoice_activity : "";
  // Metadata says "invoice" but the fields never actually got saved (e.g.
  // the toggle was flipped and the page left before blur-save fired) —
  // treat as receipt rather than showing an invoice with blank fields.
  if (!companyName && !afm) return { taxDocumentType: "receipt" };

  return { taxDocumentType: "invoice", invoiceDetails: { companyName, afm, doy, activity } };
}

export function toDomainCart(c: MedusaCart): Cart {
  const items = c.items.map((item) => ({
    id: item.id,
    productHandle: item.product_handle,
    title: item.title,
    quantity: item.quantity,
    unitPrice: { amount: item.unit_price, currencyCode: "EUR" as const },
    compareAtUnitPrice:
      item.compare_at_unit_price && item.compare_at_unit_price > item.unit_price
        ? { amount: item.compare_at_unit_price, currencyCode: "EUR" as const }
        : undefined,
    lineTotal: { amount: item.unit_price * item.quantity, currencyCode: "EUR" as const },
    placeholderTone: toneFor(item.product_handle),
  }));

  return {
    id: c.id,
    regionId: c.region_id,
    email: c.email ?? undefined,
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    // `item_subtotal`, not `subtotal` — Medusa's `subtotal` silently folds
    // in shipping once a shipping method is set (confirmed live during
    // Phase 4B checkout research; see PROJECT_MEMORY.md). Using `subtotal`
    // here would double-count shipping the moment checkout adds a method.
    subtotal: { amount: c.item_subtotal, currencyCode: "EUR" },
    discountTotal: { amount: c.discount_total, currencyCode: "EUR" },
    shippingTotal: { amount: c.shipping_total, currencyCode: "EUR" },
    hasShippingMethod: c.shipping_methods.length > 0,
    total: { amount: c.total, currencyCode: "EUR" },
    // Medusa can leave a dangling reference in `cart.promotions` if the
    // underlying promotion is deleted/deactivated while still applied to
    // someone's cart (confirmed live: it comes back as `null`, not omitted)
    // — filter those out rather than crash. `getCart()` is called from
    // RootLayout, so an unhandled throw here takes down every page.
    promotions: c.promotions.filter((p): p is NonNullable<typeof p> => p != null).map((p) => ({
      code: p.code,
      percentage: p.application_method?.type === "percentage" ? p.application_method.value : undefined,
    })),
    shippingAddress: c.shipping_address ? toAddressSummary(c.shipping_address) : undefined,
    billingAddress: c.billing_address ? toAddressSummary(c.billing_address) : undefined,
    ...parseTaxDocumentMetadata(c.metadata),
  };
}

export function toAddressSummary(a: NonNullable<MedusaCart["shipping_address"]>) {
  return {
    fullName: [a.first_name, a.last_name].filter(Boolean).join(" "),
    addressLine1: a.address_1 ?? "",
    addressLine2: a.address_2 ?? undefined,
    city: a.city ?? "",
    postalCode: a.postal_code ?? "",
    phone: a.phone ?? undefined,
  };
}

// Read-only — safe to call from Server Components (cookies() is readable
// there, just not writable; writing the cart_id cookie only happens from
// the mutation Server Actions in lib/actions/cart.ts).
export async function getCart(): Promise<Cart | null> {
  const cartId = (await cookies()).get(CART_ID_COOKIE)?.value;
  if (!cartId) return null;

  try {
    const { cart } = await medusaFetch<{ cart: MedusaCart }>(
      `/store/carts/${cartId}?fields=${CART_FIELDS}`,
      { cache: "no-store" }
    );
    return toDomainCart(cart);
  } catch (err) {
    // A stale/expired cart id (server restart, cart pruned) shouldn't crash
    // the header or the cart page — treat it the same as "no cart yet".
    if (err instanceof MedusaApiError && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
}
