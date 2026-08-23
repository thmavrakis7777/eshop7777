import "server-only";
import { transaction } from "@/lib/db/client";

export type NewsletterSubscribeStatus = "subscribed" | "already_subscribed";

/**
 * Upserts by lower(email) inside one transaction so a concurrent duplicate
 * submission can't race the SELECT and both insert — the second call always
 * sees the first's row and reports already_subscribed instead of erroring.
 */
export async function subscribeToNewsletter(email: string): Promise<NewsletterSubscribeStatus> {
  return transaction(async (tx) => {
    const existing = await tx<{ is_active: boolean }[]>`
      SELECT is_active FROM shop.newsletter_subscriber WHERE lower(email) = lower(${email})`;

    if (existing[0]?.is_active) {
      return "already_subscribed";
    }

    if (existing.length > 0) {
      // Previously unsubscribed — signing up again is a fresh subscription.
      await tx`
        UPDATE shop.newsletter_subscriber
           SET is_active = true, unsubscribed_at = NULL, subscribed_at = now()
         WHERE lower(email) = lower(${email})`;
    } else {
      await tx`INSERT INTO shop.newsletter_subscriber (email) VALUES (${email})`;
    }
    return "subscribed";
  });
}
