"use server";

import { checkRateLimit, rateLimitKey } from "@/lib/auth/session";
import { isValidEmail, isValidPhone } from "@/lib/checkout-validation";
import { sendContactMessageEmail } from "@/lib/email/send";

export type ContactField = "name" | "email" | "phone" | "message";

export type ContactActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<ContactField, string>> };

const GENERIC_ERROR =
  "Δεν ήταν δυνατή η αποστολή του μηνύματος. Δοκιμάστε ξανά ή καλέστε μας στο τηλέφωνο του καταστήματος.";

// Generous for a real question, small enough that the form cannot be used to
// push pages of text through the owner's inbox.
const MAX_MESSAGE = 3000;
const MAX_SHORT = 120;

/**
 * The /epikoinonia contact form. Nothing is stored: the message goes straight
 * to the owner's inbox (sendContactMessageEmail), with Reply-To set to the
 * customer. Two cheap spam guards and no third-party service:
 *   - `website` is a honeypot field hidden from people; a bot that fills it
 *     gets a normal-looking success and nothing is sent.
 *   - 5 messages per IP per hour, the same limiter the newsletter uses.
 */
export async function sendContactMessageAction(input: {
  name: string;
  email: string;
  phone: string;
  orderNumber: string;
  message: string;
  website: string;
}): Promise<ContactActionResult> {
  if (input.website.trim()) return { ok: true };

  const name = input.name.trim().slice(0, MAX_SHORT);
  const email = input.email.trim().toLowerCase().slice(0, MAX_SHORT);
  const phone = input.phone.trim().slice(0, 30);
  const orderNumber = input.orderNumber.trim().replace(/^#/, "").slice(0, 20);
  const message = input.message.trim();

  const fieldErrors: Partial<Record<ContactField, string>> = {};
  if (!name) fieldErrors.name = "Συμπληρώστε το όνομά σας.";
  if (!isValidEmail(email)) fieldErrors.email = "Συμπληρώστε ένα έγκυρο email, για να μπορέσουμε να σας απαντήσουμε.";
  if (phone && !isValidPhone(phone)) fieldErrors.phone = "Το τηλέφωνο πρέπει να έχει 10 ψηφία.";
  if (message.length < 5) fieldErrors.message = "Γράψτε το μήνυμά σας.";
  else if (message.length > MAX_MESSAGE) fieldErrors.message = `Το μήνυμα ξεπερνά τους ${MAX_MESSAGE} χαρακτήρες.`;
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Ελέγξτε τα πεδία που σημειώνονται.", fieldErrors };
  }

  if (!(await checkRateLimit(await rateLimitKey("contact"), 5, 3600))) {
    return { ok: false, error: "Έχετε στείλει πολλά μηνύματα σε σύντομο χρόνο. Δοκιμάστε ξανά σε λίγο." };
  }

  const sent = await sendContactMessageEmail({
    name,
    email,
    phone: phone || null,
    orderNumber: orderNumber || null,
    body: message,
  });
  if (!sent) {
    // Never log the message or the customer's details — unauthenticated PII.
    console.error("[contact] SEND_FAILED");
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true };
}
