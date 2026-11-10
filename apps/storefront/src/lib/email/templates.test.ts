import { describe, expect, it } from "vitest";
import {
  cancellationHtml,
  deliveredThankYouHtml,
  deliveredThankYouText,
  orderConfirmationHtml,
  orderConfirmationText,
  ownerOrderNotificationHtml,
  ownerOrderNotificationText,
  readyNotificationHtml,
  readyNotificationText,
  shipmentNotificationHtml,
  shipmentNotificationText,
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
    isPickup: false,
    isLocalDelivery: false,
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
    customerNote: null,
    paymentStatus: "unpaid",
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

const REVIEW_URL = "g.page/r/";

describe("Google review ask", () => {
  const ctx = { storeName: "Κατάστημα", contact, orderUrl: "https://x.test" };
  const shipped = { ...order(null), courierName: "ACS", trackingCode: "123" };

  it("is not in the shipment or ready emails, sent before the customer has the goods", () => {
    for (const output of [
      shipmentNotificationHtml(shipped, ctx),
      shipmentNotificationText(shipped, ctx),
      readyNotificationHtml(order(null), { ...ctx, kind: "pickup" }),
      readyNotificationText(order(null), { ...ctx, kind: "local" }),
    ]) {
      expect(output).not.toContain(REVIEW_URL);
    }
  });

  it("is in the thank-you email sent on «Παραδόθηκε»", () => {
    expect(deliveredThankYouHtml(order(null), ctx)).toContain(REVIEW_URL);
    expect(deliveredThankYouText(order(null), ctx)).toContain(REVIEW_URL);
  });
});

describe("customer note («Σχόλια παραγγελίας»)", () => {
  const note = { ...order(null), customerNote: "κουδούνι <Παπαδάκης>\n2ος όροφος" };

  it("reaches the owner's alert and the customer's confirmation, escaped, line breaks kept", () => {
    const ownerHtml = ownerOrderNotificationHtml(note, { storeName: "Κατάστημα", contact, adminOrderUrl: "https://x.test" });
    const html = orderConfirmationHtml(note, { storeName: "Κατάστημα", contact, orderUrl: "https://x.test" });
    for (const output of [ownerHtml, html]) {
      expect(output).toContain("Σχόλια παραγγελίας");
      expect(output).toContain("κουδούνι &lt;Παπαδάκης&gt;<br>2ος όροφος");
    }
    expect(ownerOrderNotificationText(note, { adminOrderUrl: "https://x.test" })).toContain("Σχόλια παραγγελίας: κουδούνι");
  });

  it("adds nothing when the customer left it empty", () => {
    expect(ownerOrderNotificationHtml(order(null), { storeName: "Κατάστημα", contact, adminOrderUrl: "https://x.test" })).not.toContain(
      "Σχόλια παραγγελίας"
    );
  });
});

describe("cancellation email refund line", () => {
  const ctx = { storeName: "Κατάστημα", contact };
  it("is absent for an unpaid cash-on-delivery order", () => {
    expect(cancellationHtml(order(null), ctx)).not.toContain("επιστροφή των χρημάτων");
  });
  it("is there for a cash-on-delivery order already paid", () => {
    expect(cancellationHtml({ ...order(null), paymentStatus: "paid" }, ctx)).toContain("επιστροφή των χρημάτων");
  });
});
