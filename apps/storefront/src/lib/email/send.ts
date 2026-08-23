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
 * this app calls out to Resend. Three send functions (password reset, order
 * confirmation, shipment notification); one transport (send-core.ts); one
 * set of HTML/text builders (templates.ts).
 *
 * Degrades to a logged no-op when RESEND_API_KEY/RESEND_FROM_EMAIL are
 * unset, exactly as the SendGrid version did: password reset and order
 * confirmation must never break because email is unconfigured, and in
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

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${siteUrl}/logariasmos/nea-kodikos?token=${encodeURIComponent(token)}`;
  await send({
    to,
    subject: "Επαναφορά κωδικού πρόσβασης",
    text:
      `Ζήτησες επαναφορά του κωδικού σου.\n\nΆνοιξε τον παρακάτω σύνδεσμο για να ορίσεις νέο κωδικό:\n${link}\n\n` +
      `Ο σύνδεσμος ισχύει για 30 λεπτά και μπορεί να χρησιμοποιηθεί μία φορά.\n` +
      `Αν δεν το ζήτησες εσύ, αγνόησε αυτό το email — ο κωδικός σου παραμένει ίδιος.`,
    html: `<!doctype html><html lang="el"><body style="margin:0;padding:24px;background:#f6f5f3;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1b19">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">Επαναφορά κωδικού πρόσβασης</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">Ζήτησες επαναφορά του κωδικού σου. Πάτησε το κουμπί για να ορίσεις νέο.</p>
    <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1c1b19;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">Ορισμός νέου κωδικού</a></p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6b6862">Ο σύνδεσμος ισχύει για 30 λεπτά και μπορεί να χρησιμοποιηθεί μία φορά. Αν δεν το ζήτησες εσύ, αγνόησε αυτό το email — ο κωδικός σου παραμένει ίδιος.</p>
    <p style="margin:32px 0 0;font-size:12px;color:#6b6862">${escapeHtml((await getBranding()).storeName)}</p>
  </div>
</body></html>`,
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
