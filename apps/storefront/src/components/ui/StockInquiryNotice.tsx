"use client";

import { WhatsAppIcon, PhoneIcon } from "@/components/ui/Icons";
import { telHref } from "@/components/layout/PhoneOrders";
import { buildStockInquiryWhatsappUrl } from "@/lib/whatsapp";

/**
 * Global stock-quantity-limit + direct-inquiry feature. Shown next to a
 * quantity control (Product Page, Cart Page, Mini-Cart, Checkout order
 * summary) whenever the requested quantity exceeds what's actually in stock
 * — the same component everywhere on purpose (see lib/stock.ts), so the
 * wording/behavior can never drift between surfaces.
 *
 * `role="status"` (not "alert"): this reflects a live quantity the shopper
 * is actively changing, not a one-off error — it should be announced when it
 * appears, without the more forceful interruption `role="alert"` implies.
 */
export function StockInquiryNotice({
  message,
  productTitle,
  productCode,
  whatsappPhone,
  contactPhone,
}: {
  message: string;
  productTitle: string;
  productCode?: string | null;
  whatsappPhone: string | null;
  contactPhone: string | null;
}) {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-sm border border-danger/30 bg-danger/5 px-3.5 py-3 text-sm">
      <p className="text-danger">{message}</p>
      {(whatsappPhone || contactPhone) && (
        <div className="flex flex-wrap gap-2">
          {whatsappPhone && (
            <a
              href={buildStockInquiryWhatsappUrl(whatsappPhone, productTitle, productCode)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Επικοινωνία μέσω WhatsApp για το προϊόν ${productTitle}`}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-bg px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-ink"
            >
              <WhatsAppIcon className="h-4 w-4" />
              WhatsApp
            </a>
          )}
          {contactPhone && (
            <a
              href={telHref(contactPhone)}
              aria-label={`Τηλεφωνική επικοινωνία: ${contactPhone}`}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-bg px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-ink"
            >
              <PhoneIcon className="h-4 w-4" />
              Κλήση
            </a>
          )}
        </div>
      )}
    </div>
  );
}
