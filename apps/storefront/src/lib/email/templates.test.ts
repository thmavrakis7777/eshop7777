import { describe, expect, it } from "vitest";
import {
  orderConfirmationHtml,
  orderConfirmationText,
  ownerOrderNotificationHtml,
  ownerOrderNotificationText,
} from "@/lib/email/templates";
import type { OrderEmailData } from "@/lib/db/order-email";

const contact = { phone: null, email: null, address: null };

function order(invoice: OrderEmailData["invoice"]): OrderEmailData {
  return {
    id: "order-1",
    orderNumber: 1001,
    email: "pelatis@example.com",
    createdAtFormatted: "2 Οκτ 2026",
    items: [],
    subtotalCents: 1000,
    discountCents: 0,
    discountCode: null,
    shippingCents: 0,
    shippingMethodName: null,
    vatCents: 194,
    vatRate: 24,
    totalCents: 1000,
    paymentMethod: "cod",
    shippingAddress: null,
    courierName: null,
    trackingCode: null,
    trackingUrl: null,
    loyaltyReward: null,
    invoice,
  };
}

// Made-up business, not a real ΑΦΜ. The "&" checks the name is escaped.
const INVOICE = { companyName: "Α & Β Ο.Ε.", afm: "123456789", doy: "Α' ΗΡΑΚΛΕΙΟΥ", activity: "ΛΙΑΝΙΚΟ ΕΜΠΟΡΙΟ" };

describe("invoice details in the order emails", () => {
  it("shows the Τιμολόγιο details in the customer's confirmation", () => {
    const html = orderConfirmationHtml(order(INVOICE), { storeName: "Κατάστημα", contact, orderUrl: "https://x.test" });
    expect(html).toContain("Τιμολόγιο");
    expect(html).toContain("Α &amp; Β Ο.Ε.");
    expect(html).toContain("ΑΦΜ: 123456789 · ΔΟΥ: Α&#39; ΗΡΑΚΛΕΙΟΥ");
    expect(html).toContain("ΛΙΑΝΙΚΟ ΕΜΠΟΡΙΟ");

    const text = orderConfirmationText(order(INVOICE), { storeName: "Κατάστημα", orderUrl: "https://x.test" });
    expect(text).toContain("Τιμολόγιο: Α & Β Ο.Ε.");
    expect(text).toContain("ΑΦΜ: 123456789 · ΔΟΥ: Α' ΗΡΑΚΛΕΙΟΥ");
    expect(text).toContain("Δραστηριότητα: ΛΙΑΝΙΚΟ ΕΜΠΟΡΙΟ");
  });

  it("shows them in the owner's new-order alert too", () => {
    const html = ownerOrderNotificationHtml(order(INVOICE), {
      storeName: "Κατάστημα",
      contact,
      adminOrderUrl: "https://x.test/admin",
    });
    expect(html).toContain("Τιμολόγιο");
    expect(html).toContain("ΑΦΜ: 123456789");

    const text = ownerOrderNotificationText(order(INVOICE), { adminOrderUrl: "https://x.test/admin" });
    expect(text).toContain("Τιμολόγιο: Α & Β Ο.Ε.");
  });

  it("leaves an Απόδειξη order's emails exactly as before", () => {
    const html = orderConfirmationHtml(order(null), { storeName: "Κατάστημα", contact, orderUrl: "https://x.test" });
    const ownerHtml = ownerOrderNotificationHtml(order(null), { storeName: "Κατάστημα", contact, adminOrderUrl: "https://x.test" });
    const text = orderConfirmationText(order(null), { storeName: "Κατάστημα", orderUrl: "https://x.test" });
    for (const output of [html, ownerHtml, text]) {
      expect(output).not.toContain("Τιμολόγιο");
      expect(output).not.toContain("ΑΦΜ");
    }
  });

  it("skips the activity line when there is none", () => {
    const text = orderConfirmationText(order({ ...INVOICE, activity: "" }), { storeName: "Κατάστημα", orderUrl: "https://x.test" });
    expect(text).not.toContain("Δραστηριότητα");
  });
});
