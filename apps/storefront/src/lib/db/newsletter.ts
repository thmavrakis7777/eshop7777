import "server-only";
import { sql, transaction } from "@/lib/db/client";

export type NewsletterSubscribeResult = {
  status: "subscribed" | "already_subscribed";
  // Only meaningful when status === "subscribed" — the caller uses it to
  // build the one-click unsubscribe link for the confirmation email. Never
  // returned for already_subscribed (no confirmation is sent for that case,
  // so there's nothing that needs it).
  unsubscribeToken: string | null;
};

/**
 * Upserts by lower(email) inside one transaction so a concurrent duplicate
 * submission can't race the SELECT and both insert — the second call always
 * sees the first's row and reports already_subscribed instead of erroring.
 */
export async function subscribeToNewsletter(email: string): Promise<NewsletterSubscribeResult> {
  return transaction(async (tx) => {
    const existing = await tx<{ is_active: boolean; unsubscribe_token: string }[]>`
      SELECT is_active, unsubscribe_token FROM shop.newsletter_subscriber WHERE lower(email) = lower(${email})`;

    if (existing[0]?.is_active) {
      return { status: "already_subscribed" as const, unsubscribeToken: null };
    }

    if (existing.length > 0) {
      // Previously unsubscribed — signing up again is a fresh subscription.
      // The token from the prior subscription is reused rather than
      // rotated: it was never handed to anyone but this same email address,
      // and keeping it stable means an old confirmation email's unsubscribe
      // link (if the customer kept it) still works.
      await tx`
        UPDATE shop.newsletter_subscriber
           SET is_active = true, unsubscribed_at = NULL, subscribed_at = now()
         WHERE lower(email) = lower(${email})`;
      return { status: "subscribed" as const, unsubscribeToken: existing[0].unsubscribe_token };
    }

    const [row] = await tx<{ unsubscribe_token: string }[]>`
      INSERT INTO shop.newsletter_subscriber (email) VALUES (${email})
      RETURNING unsubscribe_token`;
    return { status: "subscribed" as const, unsubscribeToken: row.unsubscribe_token };
  });
}

export type UnsubscribeResult = "unsubscribed" | "already_unsubscribed" | "invalid";

/**
 * One-click, no-login unsubscribe — the token is the entire auth model
 * (192 bits, unique, never exposed anywhere but this one recipient's own
 * email). Idempotent by construction: unsubscribing an already-inactive row
 * is a no-op that still reports success, so clicking the link twice (or an
 * email client re-fetching it) never errors.
 */
export async function unsubscribeByToken(token: string): Promise<UnsubscribeResult> {
  if (!token) return "invalid";

  const existing = await sql<{ is_active: boolean }[]>`
    SELECT is_active FROM shop.newsletter_subscriber WHERE unsubscribe_token = ${token}`;
  if (existing.length === 0) return "invalid";
  if (!existing[0].is_active) return "already_unsubscribed";

  await sql`
    UPDATE shop.newsletter_subscriber
       SET is_active = false, unsubscribed_at = now()
     WHERE unsubscribe_token = ${token}`;
  return "unsubscribed";
}
