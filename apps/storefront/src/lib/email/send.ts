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
  shell,
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

// The short emails (password, welcome, newsletter, back-in-stock) wear the
// same branded frame as the order emails — logo on top, shop contact and
// legal links underneath — instead of a bare card (owner's request,
// 2026-11-09).
async function simpleShell(heading: string, bodyHtml: string, storeName: string): Promise<string> {
  return shell({
    previewText: heading,
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1c1b19">${escapeHtml(heading)}</h1>
    <div style="color:#1c1b19">${bodyHtml}</div>`,
    storeName,
    contact: await contactInfo(),
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${siteUrl}/logariasmos/nea-kodikos?token=${encodeURIComponent(token)}`;
  const { storeName } = await getBranding();
  await send({
    to,
    subject: "Επαναφορά κωδικού πρόσβασης",
    text:
      `Ζητήσατε επαναφορά του κωδικού σας.\n\nΑνοίξτε τον παρακάτω σύνδεσμο για να ορίσετε νέο κωδικό:\n${link}\n\n` +
      `Ο σύνδεσμος ισχύει για 30 λεπτά και μπορεί να χρησιμοποιηθεί μία φορά.\n` +
      `Αν δεν το ζητήσατε εσείς, αγνοήστε αυτό το email — ο κωδικός σας παραμένει ίδιος.`,
    html: await simpleShell(
      "Επαναφορά κωδικού πρόσβασης",
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">Ζητήσατε επαναφορά του κωδικού σας. Πατήστε το κουμπί για να ορίσετε νέο.</p>
       <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1c1b19;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">Ορισμός νέου κωδικού</a></p>
       <p style="margin:0;font-size:13px;line-height:1.6;color:#6b6862">Ο σύνδεσμος ισχύει για 30 λεπτά και μπορεί να χρησιμοποιηθεί μία φορά. Αν δεν το ζητήσατε εσείς, αγνοήστε αυτό το email — ο κωδικός σας παραμένει ίδιος.</p>`,
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
    subject: `Καλώς ήρθατε στο ${storeName}`,
    text:
      `Γεια σας ${firstName},\n\nΟ λογαριασμός σας στο ${storeName} δημιουργήθηκε με επιτυχία.\n\n` +
      `Από τον λογαριασμό σας μπορείτε να βλέπετε το ιστορικό των παραγγελιών σας, να αποθηκεύετε διευθύνσεις ` +
      `παράδοσης και να ολοκληρώνετε πιο γρήγορα την επόμενη παραγγελία σας.\n\n${accountUrl}`,
    html: await simpleShell(
      `Καλώς ήρθατε στο ${storeName}`,
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">Γεια σας ${escapeHtml(firstName)},</p>
       <p style="margin:0 0 16px;font-size:14px;line-height:1.6">Ο λογαριασμός σας δημιουργήθηκε με επιτυχία. Από εδώ και πέρα μπορείτε να βλέπετε το ιστορικό των παραγγελιών σας, να αποθηκεύετε διευθύνσεις παράδοσης και να ολοκληρώνετε πιο γρήγορα την επόμενη παραγγελία σας.</p>
       <p style="margin:0 0 24px"><a href="${escapeHtml(accountUrl)}" style="display:inline-block;background:#1c1b19;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">Ο λογαριασμός μου</a></p>`,
      storeName
    ),
  });
}

const NEWSLETTER_DEFAULTS = {
  subject: (storeName: string) => `Καλώς ήρθατε στη λέσχη ${storeName}`,
  heading: (storeName: string) => `Καλώς ήρθατε στη λέσχη ${storeName}`,
  body: "Ευχαριστούμε που εγγραφήκατε! Θα λαμβάνετε νέες αφίξεις, οδηγούς αγορών και αποκλειστικές προσφορές απευθείας στο inbox σας.",
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
    html: await simpleShell(
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
    html: await simpleShell(
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
    subject: "Ο κωδικός πρόσβασής σας άλλαξε",
    text:
      `Ο κωδικός πρόσβασης του λογαριασμού σας στο ${storeName} άλλαξε μόλις τώρα.\n\n` +
      `Αν το κάνατε εσείς, δεν χρειάζεται να κάνετε τίποτα.\n\n` +
      (contactLine
        ? `Αν δεν το κάνατε εσείς, επικοινωνήστε μαζί μας άμεσα στο ${contactLine}.`
        : `Αν δεν το κάνατε εσείς, επικοινωνήστε μαζί μας άμεσα.`),
    html: await simpleShell(
      "Ο κωδικός πρόσβασής σας άλλαξε",
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">Ο κωδικός πρόσβασης του λογαριασμού σας στο ${escapeHtml(storeName)} άλλαξε μόλις τώρα.</p>
       <p style="margin:0 0 16px;font-size:14px;line-height:1.6">Αν το κάνατε εσείς, δεν χρειάζεται να κάνετε τίποτα.</p>
       <p style="margin:0;font-size:14px;line-height:1.6;font-weight:600">${
         contactLine
           ? `Αν δεν το κάνατε εσείς, επικοινωνήστε μαζί μας άμεσα στο ${escapeHtml(contactLine)}.`
           : `Αν δεν το κάνατε εσείς, επικοινωνήστε μαζί μας άμεσα.`
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

/**
 * «Ενημέρωσέ με όταν παραληφθεί» — sent once per request when a sold-out
 * variant the customer asked about has stock again. lib/stock-notifications.ts
 * decides when; this only sends. Returns whether it went out, so a failed
 * send is released back into the queue instead of silently lost.
 */
export async function sendBackInStockEmail(to: string, product: { title: string; url: string }): Promise<boolean> {
  const { storeName } = await getBranding();
  return send({
    to,
    subject: `Ξανά διαθέσιμο: ${product.title} | ${storeName}`,
    text:
      `Γεια σας,\n\nΤο προϊόν «${product.title}», για το οποίο ζητήσατε ενημέρωση, είναι ξανά διαθέσιμο στο ${storeName}.\n\n` +
      `${product.url}\n\nΛαμβάνετε αυτό το email μία φορά, επειδή ζητήσατε ειδοποίηση για αυτό το προϊόν.`,
    html: await simpleShell(
      "Ξανά διαθέσιμο",
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">Το προϊόν <strong>${escapeHtml(product.title)}</strong>, για το οποίο ζητήσατε ενημέρωση, είναι ξανά διαθέσιμο.</p>
       <p style="margin:0 0 24px"><a href="${escapeHtml(product.url)}" style="display:inline-block;background:#1c1b19;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">Δείτε το προϊόν</a></p>
       <p style="margin:0;font-size:12px;line-height:1.6;color:#6b6862">Λαμβάνετε αυτό το email μία φορά, επειδή ζητήσατε ειδοποίηση για αυτό το προϊόν.</p>`,
      storeName
    ),
  });
}
