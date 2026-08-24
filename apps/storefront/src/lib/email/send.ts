import "server-only";
import { siteUrl } from "@/lib/site-config";
import { getBranding } from "@/lib/data/branding";
import { getSiteSettings } from "@/lib/db/content";
import { send, escapeHtml } from "@/lib/email/send-core";
import {
  orderConfirmationHtml,
  orderConfirmationText,
  ownerOrderNotificationHtml,
  ownerOrderNotificationText,
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

const NEWSLETTER_DEFAULTS = {
  subject: (storeName: string) => `Καλώς ήρθες στη λέσχη ${storeName}`,
  heading: (storeName: string) => `Καλώς ήρθες στη λέσχη ${storeName}`,
  body: "Ευχαριστούμε που εγγράφηκες! Θα λαμβάνεις νέες αφίξεις, οδηγούς αγορών και αποκλειστικές προσφορές απευθείας στο inbox σου.",
};

/**
 * Sent right after a successful newsletter signup (lib/actions/newsletter.ts).
 * Purely informational, single opt-in — no verification link, on the
 * explicit instruction that already shaped that feature: the checkbox
 * itself is the consent, this just confirms it landed.
 *
 * Subject/heading/body/button/footer are owner-editable (Admin -> Settings
 * -> Email); every field falls back to the shipped Greek copy above when
 * unset, so an empty settings row reads exactly as it did before these
 * existed. The unsubscribe link is NOT part of that editable copy — it is
 * always appended, always built server-side from this specific recipient's
 * own token, so there is no way to edit it away or point it at someone
 * else's subscription.
 */
export async function sendNewsletterConfirmationEmail(to: string, unsubscribeToken: string): Promise<void> {
  const { storeName } = await getBranding();
  const settings = await getSiteSettings();
  const unsubscribeUrl = `${siteUrl}/newsletter/apengrafi?token=${encodeURIComponent(unsubscribeToken)}`;

  const subject = settings?.newsletterSubject?.trim() || NEWSLETTER_DEFAULTS.subject(storeName);
  const heading = settings?.newsletterHeading?.trim() || NEWSLETTER_DEFAULTS.heading(storeName);
  const body = settings?.newsletterBody?.trim() || NEWSLETTER_DEFAULTS.body;
  const buttonText = settings?.newsletterButtonText?.trim() || null;
  const buttonUrlRaw = settings?.newsletterButtonUrl?.trim() || null;
  const buttonUrl = buttonUrlRaw ? (buttonUrlRaw.startsWith("http") ? buttonUrlRaw : `${siteUrl}${buttonUrlRaw}`) : null;
  const footer = settings?.newsletterFooter?.trim() || null;

  const buttonHtml =
    buttonText && buttonUrl
      ? `<p style="margin:0 0 20px"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#1c1b19;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">${escapeHtml(buttonText)}</a></p>`
      : "";

  await send({
    to,
    subject,
    fromOverride: settings?.newsletterFromEmail ?? undefined,
    text:
      `${body}\n\n` +
      (buttonText && buttonUrl ? `${buttonText}: ${buttonUrl}\n\n` : "") +
      (footer ? `${footer}\n\n` : "") +
      `Διαγραφή από το newsletter: ${unsubscribeUrl}`,
    html: simpleShell(
      heading,
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(body)}</p>
       ${buttonHtml}
       ${footer ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b6862">${escapeHtml(footer)}</p>` : ""}
       <p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e7e5e1;font-size:12px;color:#8890999a"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#8890999a;text-decoration:underline">Διαγραφή από το newsletter</a></p>`,
      storeName
    ),
  });
}

/**
 * Owner-facing: "someone subscribed." Independent of, and never blocks, the
 * customer-facing confirmation above. Skipped entirely (not a config-missing
 * log — this is a genuinely optional feature) when no notification address
 * is set, since unlike order notifications there is no sensible fallback
 * recipient for "someone joined the newsletter."
 */
export async function sendNewsletterSignupNotificationEmail(subscriberEmail: string): Promise<void> {
  const settings = await getSiteSettings();
  const to = settings?.newsletterNotificationEmail?.trim();
  if (!to) return;

  const { storeName } = await getBranding();
  await send({
    to,
    subject: `Νέα εγγραφή newsletter | ${storeName}`,
    text: `Ένας νέος συνδρομητής εγγράφηκε στο newsletter: ${subscriberEmail}`,
    html: simpleShell(
      "Νέα εγγραφή newsletter",
      `<p style="margin:0;font-size:14px;line-height:1.6">Ένας νέος συνδρομητής εγγράφηκε στο newsletter: <strong>${escapeHtml(subscriberEmail)}</strong></p>`,
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
 * Sent to the owner right after checkout completes — independent of, and
 * never blocking, the customer confirmation above (a failure here must not
 * read back as "the order failed"). Recipient: the configured owner
 * notification address, falling back to the public contact email so this
 * works out of the box before anyone visits Admin -> Settings -> Email.
 * Silently skipped (not logged as config-missing) only when genuinely
 * neither is set — a store with no contact email configured at all has
 * bigger problems than a missing order alert, but this still must not
 * throw.
 */
export async function sendOwnerOrderNotificationEmail(order: OrderEmailData): Promise<boolean> {
  const settings = await getSiteSettings();
  const to = settings?.ownerNotificationEmail?.trim() || settings?.contactEmail?.trim();
  if (!to) return false;

  const { storeName } = await getBranding();
  const contact = await contactInfo();
  const adminOrderUrl = `${siteUrl}/admin/orders/${order.id}`;

  return send({
    to,
    subject: `Νέα παραγγελία #${order.orderNumber} | ${storeName}`,
    html: ownerOrderNotificationHtml(order, { storeName, contact, adminOrderUrl }),
    text: ownerOrderNotificationText(order, { adminOrderUrl }),
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
