import type { SiteSettings } from "@/lib/content-types";

/**
 * Global stock-quantity-limit + direct-inquiry feature — WhatsApp/notice
 * helpers shared by the Product Page, Cart Page, Mini-Cart and Checkout, so
 * "how do we build the WhatsApp link / fall back the notice text" lives in
 * exactly one place (see StockInquiryNotice, the shared component that reads
 * these).
 */

export const DEFAULT_STOCK_INQUIRY_MESSAGE =
  "Η ζητούμενη ποσότητα δεν είναι διαθέσιμη. Επικοινωνήστε μαζί μας για μεγαλύτερη ποσότητα.";

// Same "admin can leave it blank, a sensible default still shows" pattern as
// resolvePhoneOrders' label fallback (components/layout/PhoneOrders.tsx).
export function resolveStockInquiryMessage(message: string | null | undefined): string {
  return message?.trim() || DEFAULT_STOCK_INQUIRY_MESSAGE;
}

/** Digits only, no leading +/00 — the format wa.me links want. */
export function normalizeWhatsappPhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

// Loose on purpose (same spirit as isValidPhone in checkout-validation.ts):
// full international format (country code + number), no per-country rules.
export function isValidWhatsappPhone(raw: string): boolean {
  const digits = normalizeWhatsappPhone(raw);
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * The three values every stock-inquiry notice needs, resolved once from
 * site settings and threaded down through props — never re-derived at each
 * call site. `contactPhone` is deliberately the existing site-wide number
 * (see content-types.ts), not a second phone setting.
 */
export type StockInquiryContact = {
  message: string;
  whatsappPhone: string | null;
  contactPhone: string | null;
};

export function resolveStockInquiryContact(settings: SiteSettings | null): StockInquiryContact {
  return {
    message: resolveStockInquiryMessage(settings?.stockInquiryMessage),
    whatsappPhone: settings?.whatsappPhone?.trim() || null,
    contactPhone: settings?.contactPhone?.trim() || null,
  };
}

/**
 * Product-specific WhatsApp deep link. Uses the product's own SKU/code, not
 * an internal database id, per the feature's "don't expose internal ids"
 * requirement.
 */
export function buildStockInquiryWhatsappUrl(
  whatsappPhone: string,
  productTitle: string,
  productCode?: string | null
): string {
  const codePart = productCode ? ` (κωδ. ${productCode})` : "";
  const message =
    `Καλησπέρα, ενδιαφέρομαι για μεγαλύτερη ποσότητα από τη διαθέσιμη για το προϊόν: ` +
    `${productTitle}${codePart}. Θα ήθελα πληροφορίες για διαθεσιμότητα.`;
  return `https://wa.me/${normalizeWhatsappPhone(whatsappPhone)}?text=${encodeURIComponent(message)}`;
}
