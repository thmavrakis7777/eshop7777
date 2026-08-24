"use server";

import { checkRateLimit, rateLimitKey } from "@/lib/auth/session";
import { isValidEmail } from "@/lib/checkout-validation";
import { subscribeToNewsletter } from "@/lib/db/newsletter";
import { sendNewsletterConfirmationEmail, sendNewsletterSignupNotificationEmail } from "@/lib/email/send";

export type NewsletterActionResult =
  | { ok: true; status: "subscribed" | "already_subscribed" }
  | { ok: false; error: string };

const GENERIC_ERROR = "Κάτι πήγε στραβά. Παρακαλούμε δοκιμάστε ξανά.";

export async function subscribeToNewsletterAction(input: {
  email: string;
  consent: boolean;
}): Promise<NewsletterActionResult> {
  const email = input.email.trim().toLowerCase();

  // The checkbox is the actual legal basis for this signup (explicit
  // opt-in, matching the site's cookie-consent pattern) — re-checked here
  // because the client-side disabled state is only a UX nicety, not a
  // security boundary.
  if (!input.consent) {
    return { ok: false, error: "Χρειαζόμαστε τη συναίνεσή σου για να σε εγγράψουμε στο newsletter." };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: "Μη έγκυρη διεύθυνση email." };
  }
  if (!(await checkRateLimit(await rateLimitKey("newsletter"), 5, 3600))) {
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const { status, unsubscribeToken } = await subscribeToNewsletter(email);
    // Only on a genuinely new (or reactivated) subscription — not on
    // already_subscribed, which would just be a noisy re-send to someone
    // already on the list. Guarded separately: the row is already
    // committed, so a failure here must not read back as "signup failed".
    if (status === "subscribed" && unsubscribeToken) {
      try {
        await sendNewsletterConfirmationEmail(email, unsubscribeToken);
      } catch (err) {
        console.error("[newsletter] CONFIRMATION_EMAIL_FAILED", { error: err instanceof Error ? err.message : String(err) });
      }
      // Best-effort, independent of the confirmation email above — the
      // owner not being notified must never affect what the customer sees.
      try {
        await sendNewsletterSignupNotificationEmail(email);
      } catch (err) {
        console.error("[newsletter] OWNER_NOTIFICATION_FAILED", { error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { ok: true, status };
  } catch (err) {
    // Never log the email itself — this is unauthenticated customer PII and
    // the failure mode doesn't need it to be diagnosable.
    console.error("[newsletter] SUBSCRIBE_FAILED", { error: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: GENERIC_ERROR };
  }
}
