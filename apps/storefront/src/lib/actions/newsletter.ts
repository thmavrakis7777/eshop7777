"use server";

import { checkRateLimit, rateLimitKey } from "@/lib/auth/session";
import { isValidEmail } from "@/lib/checkout-validation";
import { subscribeToNewsletter } from "@/lib/db/newsletter";

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
    const status = await subscribeToNewsletter(email);
    return { ok: true, status };
  } catch (err) {
    // Never log the email itself — this is unauthenticated customer PII and
    // the failure mode doesn't need it to be diagnosable.
    console.error("[newsletter] SUBSCRIBE_FAILED", { error: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: GENERIC_ERROR };
  }
}
