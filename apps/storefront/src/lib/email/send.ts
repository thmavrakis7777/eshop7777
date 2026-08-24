import "server-only";
import { siteUrl } from "@/lib/site-config";
import { getBranding } from "@/lib/data/branding";
import { getSiteSettings } from "@/lib/db/content";
import { send, escapeHtml } from "@/lib/email/send-core";
import {
  orderConfirmationHtml,
  orderConfirmationText,
  shipmentNotificationHtml,
  shipmentNotificationText,
} from "@/lib/email/templates";
import type { OrderEmailData } from "@/lib/db/order-email";

/**
 * The centralized transactional email service — the only place anything in
 * this app calls out to Resend. One transport (send-core.ts); one set of
 * HTML/text builders for the multi-section order/shipment emails
 * (templates.ts); simple single-message emails (reset, welcome, newsletter
 * confirmation, password-changed) built inline here with simpleShell,
 * since a whole templates.ts entry would be more machinery than a
 * three-paragraph email needs.
 *
 * Degrades to a logged no-op when RESEND_API_KEY/RESEND_FROM_EMAIL are
 * unset, exactly as the SendGrid version did: none of these must ever
 * block the action that triggers them (registration, checkout, a shipment
 * save, a password change) just because email is unconfigured — which in
 * development it usually is.
 */

async function contactInfo(): Promise<{ phone: string | null; email: string | null; address: string | null }> {
  const settings = await getSiteSettings();
  return {
    phone: settings?.contactPhone ?? null,
    email: settings?.contactEmail ?? null,
    address: settings?.contactAddress ?? null,
  };
}

function simpleShell(heading: string, bodyHtml: string, storeName: string): string {
  return `<!doctype html><html lang="el"><body style="margin:0;padding:24px;background:#f6f5f3;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1b19">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">${escapeHtml(heading)}</h1>
    ${bodyHtml}
    <p style="margin:32px 0 0;font-size:12px;color:#6b6862">${escapeHtml(storeName)}</p>
  </div>
</body></html>`;
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${siteUrl}/logariasmos/nea-kodikos?token=${encodeURIComponent(token)}`;
  const { storeName } = await getBranding();
  await send({
    to,
    subject: "Επαναφορά κωδικού πρόσβασης",
    text:
      `Ζήτησες επαναφορά του κωδικού σου.\n\nΆνοιξε τον παρακάτω σύνδεσμο για να ορίσεις νέο κωδικό:\n${link}\n\n` +
      `Ο σύνδεσμος ισχύει για 30 λεπτά και μπορεί να χρησιμοποιηθεί μία φορά.\n` +
      `Αν δεν το ζήτησες εσύ, αγνόησε αυτό το email — ο κωδικός σου παραμένει ίδιος.`,
    html: simpleShell(
      "Επαναφορά κωδικού πρόσβασης",
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">Ζήτησες επαναφορά του κωδικού σου. Πάτησε το κουμπί για να ορίσεις νέο.</p>
       <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1c1b19;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">Ορισμός νέου κωδικού</a></p>
       <p style="margin:0;font-size:13px;line-height:1.6;color:#6b6862">Ο σύνδεσμος ισχύει για 30 λεπτά και μπορεί να χρησιμοποιηθεί μία φορά. Αν δεν το ζήτησες εσύ, αγνόησε αυτό το email — ο κωδικός σου παραμένει ίδιος.</p>`,
      storeName
    ),
  });
}

/**
 * Sent right after a customer creates an account. Purely a confirmation —
 * no verification link, matching how registration already works today
 * (the account is live immediately; there is no email-verification gate).
 */
export async function sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  const { storeName } = await getBranding();
  const accountUrl = `${siteUrl}/logariasmos`;
  await send({
    to,
    subject: `Καλώς ήρθες στο ${storeName}`,
    text:
      `Γεια σου ${firstName},\n\nΟ λογαριασμός σου στο ${storeName} δημιουργήθηκε με επιτυχία.\n\n` +
      `Από τον λογαριασμό σου μπορείς να βλέπεις το ιστορικό των παραγγελιών σου, να αποθηκεύεις διευθύνσεις ` +
      `παράδοσης και να ολοκληρώνεις πιο γρήγορα την επόμενη παραγγελία σου.\n\n${accountUrl}`,
    html: simpleShell(
      `Καλώς ήρθες στο ${storeName}`,
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">Γεια σου ${escapeHtml(firstName)},</p>
       <p style="margin:0 0 16px;font-size:14px;line-height:1.6">Ο λογαριασμός σου δημιουργήθηκε με επιτυχία. Από εδώ και πέρα μπορείς να βλέπεις το ιστορικό των παραγγελιών σου, να αποθηκεύεις διευθύνσεις παράδοσης και να ολοκληρώνεις πιο γρήγορα την επόμενη παραγγελία σου.</p>
       <p style="margin:0 0 24px"><a href="${escapeHtml(accountUrl)}" style="display:inline-block;background:#1c1b19;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">Ο λογαριασμός μου</a></p>`,
      storeName
    ),
  });
}

/**
 * Sent right after a successful newsletter signup (lib/actions/newsletter.ts).
 * Purely informational, single opt-in — no verification link, on the
 * explicit instruction that already shaped that feature: the checkbox
 * itself is the consent, this just confirms it landed.
 */
export async function sendNewsletterConfirmationEmail(to: string): Promise<void> {
  const { storeName } = await getBranding();
  await send({
    to,
    subject: `Καλώς ήρθες στη λέσχη ${storeName}`,
    text:
      `Ευχαριστούμε που εγγράφηκες στο newsletter του ${storeName}!\n\n` +
      `Θα λαμβάνεις νέες αφίξεις, οδηγούς αγορών και αποκλειστικές προσφορές απευθείας στο inbox σου.\n\n` +
      `Αν θέλεις να διαγραφείς, επικοινώνησε μαζί μας.`,
    html: simpleShell(
      `Καλώς ήρθες στη λέσχη ${storeName}`,
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">Ευχαριστούμε που εγγράφηκες! Θα λαμβάνεις νέες αφίξεις, οδηγούς αγορών και αποκλειστικές προσφορές απευθείας στο inbox σου.</p>
       <p style="margin:0;font-size:13px;line-height:1.6;color:#6b6862">Αν θέλεις να διαγραφείς από τη λίστα, επικοινώνησε μαζί μας.</p>`,
      storeName
    ),
  });
}

/**
 * Sent whenever a customer's password actually changes — not on a reset
 * *request* (sendPasswordResetEmail already covers that), on the change
 * itself, from settings or via a completed reset. Deliberately no link:
 * a "did you do this" security notice shouldn't teach customers to click
 * links in emails claiming to be about their account. A phone/email
 * contact is the safer call to action if it wasn't them.
 */
export async function sendPasswordChangedEmail(to: string): Promise<void> {
  const { storeName } = await getBranding();
  const contact = await contactInfo();
  const contactLine = [contact.phone, contact.email].filter(Boolean).join(" ή στο ");
  await send({
    to,
    subject: "Ο κωδικός πρόσβασής σου άλλαξε",
    text:
      `Ο κωδικός πρόσβασης του λογαριασμού σου στο ${storeName} άλλαξε μόλις τώρα.\n\n` +
      `Αν το έκανες εσύ, δεν χρειάζεται να κάνεις τίποτα.\n\n` +
      (contactLine
        ? `Αν δεν το έκανες εσύ, επικοινώνησε μαζί μας άμεσα στο ${contactLine}.`
        : `Αν δεν το έκανες εσύ, επικοινώνησε μαζί μας άμεσα.`),
    html: simpleShell(
      "Ο κωδικός πρόσβασής σου άλλαξε",
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">Ο κωδικός πρόσβασης του λογαριασμού σου στο ${escapeHtml(storeName)} άλλαξε μόλις τώρα.</p>
       <p style="margin:0 0 16px;font-size:14px;line-height:1.6">Αν το έκανες εσύ, δεν χρειάζεται να κάνεις τίποτα.</p>
       <p style="margin:0;font-size:14px;line-height:1.6;font-weight:600">${
         contactLine
           ? `Αν δεν το έκανες εσύ, επικοινώνησε μαζί μας άμεσα στο ${escapeHtml(contactLine)}.`
           : `Αν δεν το έκανες εσύ, επικοινώνησε μαζί μας άμεσα.`
       }</p>`,
      storeName
    ),
  });
}

/**
 * Sent right after checkout completes. Returns whether it actually sent, so
 * the caller can record confirmation_email_sent_at truthfully instead of
 * assuming success — but this must still never throw or block the order.
 */
export async function sendOrderConfirmationEmail(order: OrderEmailData): Promise<boolean> {
  const { storeName } = await getBranding();
  const contact = await contactInfo();
  const orderUrl = `${siteUrl}/checkout/epibebaiosi?order=${order.id}`;

  return send({
    to: order.email,
    subject: `Η παραγγελία σας #${order.orderNumber} καταχωρήθηκε επιτυχώς | ${storeName}`,
    html: orderConfirmationHtml(order, { storeName, contact, orderUrl }),
    text: orderConfirmationText(order, { storeName, orderUrl }),
  });
}

/**
 * Sent when an admin saves courier + tracking code for the first time on an
 * order (automatic), or explicitly clicks "Resend" (manual) — the caller in
 * lib/admin/orders.ts owns that decision entirely; this function just sends.
 */
export async function sendShipmentNotificationEmail(order: OrderEmailData): Promise<boolean> {
  const { storeName } = await getBranding();
  const contact = await contactInfo();
  const orderUrl = `${siteUrl}/checkout/epibebaiosi?order=${order.id}`;

  return send({
    to: order.email,
    subject: `Η παραγγελία σας #${order.orderNumber} απεστάλη | ${storeName}`,
    html: shipmentNotificationHtml(order, { storeName, contact, orderUrl }),
    text: shipmentNotificationText(order, { storeName, orderUrl }),
  });
}
