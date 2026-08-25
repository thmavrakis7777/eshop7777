import "server-only";
import crypto from "node:crypto";

/**
 * Meta Conversions API — architecture prepared, not activated.
 *
 * Per explicit instruction: build this so it's ready to switch on, but do
 * not wire it live without real credentials (a Meta Dataset ID and a System
 * User access token, generated in Meta Business Manager → Events Manager →
 * the Pixel → Settings → Conversions API — only the store owner can create
 * those). No call site in this codebase invokes `sendServerEvent` yet.
 *
 * Same "degrade to a logged no-op when unconfigured" shape lib/email/send.ts
 * already uses for a missing SendGrid/Resend config — never throws, never
 * blocks the request it's attached to.
 *
 * Once real env vars exist, the intended integration point is server-side,
 * right where the order-confirmation email already sends — e.g. a
 * `sendServerEvent({ event: "Purchase", eventId: \`purchase-${order.id}\`, ... })`
 * call added to whatever completes checkout (lib/actions/checkout.ts /
 * lib/db/checkout.ts's order-creation function), using the exact same
 * `eventId` the browser Pixel call in lib/analytics/track.ts's
 * `trackPurchase` already generates for that order — that shared ID is what
 * lets Meta deduplicate the browser and server copies of the same event
 * instead of double-counting a sale.
 */

export type CapiEvent = {
  event: "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";
  eventId: string;
  /** Plain email — hashed below before it ever leaves this function. Never log or forward it raw. */
  userEmail?: string;
  userIp?: string;
  userAgent?: string;
  sourceUrl: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
};

/** Meta requires user data fields SHA-256 hashed, lowercased/trimmed first. */
function hashField(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export type CapiResult = { sent: true } | { sent: false; reason: "not_configured" | "request_failed" };

export async function sendServerEvent(input: CapiEvent): Promise<CapiResult> {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  const datasetId = process.env.META_DATASET_ID;

  if (!accessToken || !datasetId) {
    console.log("[analytics] CAPI_NOT_CONFIGURED", { event: input.event, eventId: input.eventId });
    return { sent: false, reason: "not_configured" };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${datasetId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        data: [
          {
            event_name: input.event,
            event_id: input.eventId,
            event_time: Math.floor(Date.now() / 1000),
            action_source: "website",
            event_source_url: input.sourceUrl,
            user_data: {
              ...(input.userEmail ? { em: [hashField(input.userEmail)] } : {}),
              ...(input.userIp ? { client_ip_address: input.userIp } : {}),
              ...(input.userAgent ? { client_user_agent: input.userAgent } : {}),
            },
            ...(input.value != null
              ? { custom_data: { value: input.value, currency: input.currency ?? "EUR", content_ids: input.contentIds } }
              : {}),
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[analytics] CAPI_SEND_FAILED", { status: res.status, event: input.event });
      return { sent: false, reason: "request_failed" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[analytics] CAPI_SEND_FAILED", { error: String(err), event: input.event });
    return { sent: false, reason: "request_failed" };
  }
}
