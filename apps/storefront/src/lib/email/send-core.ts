import "server-only";
import { getBranding } from "@/lib/data/branding";

/**
 * Resend transport — a direct call to Resend's REST API, no SDK, matching
 * every other external integration in this codebase (SendGrid before it,
 * Google Places, ΓΕΜΗ). Split from send.ts (the high-level sendXEmail
 * functions) and templates.ts (the HTML/text builders) so all three can
 * depend on this without a circular import.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Every value interpolated into an HTML email goes through this — an
// unescaped customer name/address/product title is a real XSS vector in an
// HTML email client, not a hypothetical one (this replaced an actual bug in
// the Medusa-era order-confirmation template).
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Optional per-send override of the "from" address — used only by the
  // newsletter confirmation, if the owner has set a distinct sender for it
  // in Admin -> Settings -> Email. Still just RESEND_FROM_EMAIL's domain
  // that must be Resend-verified; an invalid override simply fails the send
  // (logged as EMAIL_SEND_FAILED with Resend's own reason), it can't send
  // from an arbitrary unverified address.
  fromOverride?: string;
};

// Three distinct, greppable outcomes for production log search — so "why did
// no confirmation email arrive for order #1042" is diagnosable from logs
// alone: was email unconfigured, or did Resend actually reject the send?
// Never includes the API key; never includes a reset token or tracking
// link's full contents beyond what's already logged elsewhere.
type EmailLogEvent = "EMAIL_CONFIG_MISSING" | "EMAIL_SEND_FAILED" | "EMAIL_SEND_SUCCESS";

function logEmail(event: EmailLogEvent, detail: Record<string, string | number>): void {
  const line = `[email] ${event} ${JSON.stringify(detail)}`;
  if (event === "EMAIL_SEND_SUCCESS") console.info(line);
  else console.error(line);
}

/**
 * Sends one email. Never throws — an email provider outage must not roll
 * back an order that is already placed and whose stock is already deducted,
 * nor block a password reset the customer already requested.
 *
 * Returns whether the send actually succeeded, so callers that need to know
 * (order-confirmation and shipment-notification status shown in the admin
 * dashboard) can record it truthfully instead of assuming success.
 */
export async function send({ to, subject, html, text, fromOverride }: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = fromOverride?.trim() || process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    logEmail("EMAIL_CONFIG_MISSING", {
      subject,
      to,
      missing: !apiKey && !from ? "RESEND_API_KEY,RESEND_FROM_EMAIL" : !apiKey ? "RESEND_API_KEY" : "RESEND_FROM_EMAIL",
    });
    return false;
  }

  const { storeName } = await getBranding();
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL?.trim() || undefined;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${storeName} <${from}>`,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      // Resend's own error body is diagnostic (unverified domain, invalid
      // address, rate limit, …) and contains no secret — the Authorization
      // header itself is never included in `res`.
      const body = await res.text().catch(() => "");
      logEmail("EMAIL_SEND_FAILED", { subject, to, status: res.status, resendResponse: body.slice(0, 500) });
      return false;
    }
    logEmail("EMAIL_SEND_SUCCESS", { subject, to, status: res.status });
    return true;
  } catch (err) {
    logEmail("EMAIL_SEND_FAILED", { subject, to, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
