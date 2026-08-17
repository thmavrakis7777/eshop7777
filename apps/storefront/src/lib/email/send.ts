import "server-only";
import { siteUrl } from "@/lib/site-config";
import { getBranding } from "@/lib/data/branding";

/**
 * Transactional email. Replaces Medusa's notification module, its SendGrid
 * provider and the two subscribers that drove it — a direct call to
 * SendGrid's v3 API, no SDK.
 *
 * Degrades to a logged no-op when SENDGRID_API_KEY is unset, exactly as the
 * Medusa subscribers did. That matters: password reset and order confirmation
 * must never break because email is unconfigured, and in development it
 * usually is.
 */

const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

// Every value interpolated into an HTML email goes through this. The Medusa
// order-confirmation template shipped unescaped interpolation — a real XSS
// risk found by an earlier audit, and not one worth reintroducing.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Email = { to: string; subject: string; html: string; text: string };

async function send({ to, subject, html, text }: Email): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !from) {
    console.info(`[email] skipped "${subject}" to ${to} — SENDGRID_API_KEY/FROM_EMAIL not configured`);
    return;
  }

  const { storeName } = await getBranding();

  try {
    const res = await fetch(SENDGRID_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from, name: storeName },
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`[email] SendGrid rejected "${subject}": ${res.status} ${await res.text().catch(() => "")}`);
    }
  } catch (err) {
    // Never rethrow. An email provider outage must not roll back a placed
    // order or block a password reset the customer already requested.
    console.error(`[email] failed to send "${subject}":`, err);
  }
}

const shell = (heading: string, body: string, storeName: string) => `
<!doctype html><html lang="el"><body style="margin:0;padding:24px;background:#f6f5f3;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1b19">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">${escapeHtml(heading)}</h1>
    ${body}
    <p style="margin:32px 0 0;font-size:12px;color:#6b6862">${escapeHtml(storeName)}</p>
  </div>
</body></html>`;

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
    html: shell(
      "Επαναφορά κωδικού πρόσβασης",
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">Ζήτησες επαναφορά του κωδικού σου. Πάτησε το κουμπί για να ορίσεις νέο.</p>
       <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1c1b19;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">Ορισμός νέου κωδικού</a></p>
       <p style="margin:0;font-size:13px;line-height:1.6;color:#6b6862">Ο σύνδεσμος ισχύει για 30 λεπτά και μπορεί να χρησιμοποιηθεί μία φορά. Αν δεν το ζήτησες εσύ, αγνόησε αυτό το email — ο κωδικός σου παραμένει ίδιος.</p>`,
      storeName
    ),
  });
}

export async function sendOrderConfirmationEmail(input: {
  to: string;
  orderNumber: number;
  totalFormatted: string;
  items: Array<{ title: string; quantity: number; lineTotalFormatted: string }>;
}): Promise<void> {
  const rows = input.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;font-size:14px">${escapeHtml(i.title)} × ${i.quantity}</td>` +
        `<td style="padding:8px 0;font-size:14px;text-align:right">${escapeHtml(i.lineTotalFormatted)}</td></tr>`
    )
    .join("");

  const { storeName } = await getBranding();

  await send({
    to: input.to,
    subject: `Η παραγγελία σου #${input.orderNumber}`,
    text:
      `Ευχαριστούμε για την παραγγελία σου!\n\nΑριθμός παραγγελίας: #${input.orderNumber}\n\n` +
      input.items.map((i) => `${i.title} × ${i.quantity} — ${i.lineTotalFormatted}`).join("\n") +
      `\n\nΣύνολο: ${input.totalFormatted}`,
    html: shell(
      "Ευχαριστούμε για την παραγγελία σου!",
      `<p style="margin:0 0 16px;font-size:14px">Αριθμός παραγγελίας: <strong>#${input.orderNumber}</strong></p>
       <table style="width:100%;border-collapse:collapse;border-top:1px solid #e7e5e1">${rows}</table>
       <p style="margin:16px 0 0;padding-top:12px;border-top:1px solid #e7e5e1;font-size:15px;font-weight:600;display:flex;justify-content:space-between">
         <span>Σύνολο</span><span>${escapeHtml(input.totalFormatted)}</span></p>`,
      storeName
    ),
  });
}
