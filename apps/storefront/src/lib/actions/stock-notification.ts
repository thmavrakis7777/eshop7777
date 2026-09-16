"use server";

import { checkRateLimit, rateLimitKey } from "@/lib/auth/session";
import { isValidEmail } from "@/lib/checkout-validation";
import { createStockNotificationRequest } from "@/lib/db/stock-notifications";

export type StockNotificationActionResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Κάτι πήγε στραβά. Παρακαλούμε δοκιμάστε ξανά.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * «Ενημέρωσέ με όταν παραληφθεί» on a sold-out product. Same shape as the
 * newsletter signup (lib/actions/newsletter.ts): validated and rate-limited
 * server-side, never trusting the form. The request itself is the consent —
 * the email is used for this one notification only, as the form says.
 */
export async function requestStockNotificationAction(input: {
  variantId: string;
  email: string;
}): Promise<StockNotificationActionResult> {
  const email = String(input.email ?? "").trim().toLowerCase();
  const variantId = String(input.variantId ?? "");

  if (!isValidEmail(email)) {
    return { ok: false, error: "Μη έγκυρη διεύθυνση email." };
  }
  // A malformed id must not reach Postgres as a uuid cast error.
  if (!UUID.test(variantId)) {
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!(await checkRateLimit(await rateLimitKey("stock-notify"), 10, 3600))) {
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const result = await createStockNotificationRequest(variantId, email);
    if (result === "not_sold_out") {
      return { ok: false, error: "Το προϊόν είναι ξανά διαθέσιμο. Ανανέωσε τη σελίδα για να το παραγγείλεις." };
    }
    return { ok: true };
  } catch (err) {
    // Never log the email itself — unauthenticated customer PII, and the
    // failure doesn't need it to be diagnosable.
    console.error("[stock-notify] REQUEST_FAILED", { error: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: GENERIC_ERROR };
  }
}
