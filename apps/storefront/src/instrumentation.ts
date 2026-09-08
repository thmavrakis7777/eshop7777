import type { Instrumentation } from "next";
import { sendErrorAlert } from "@/lib/observability/alert";

/**
 * The zero-dependency error pipeline for #15 of the production audit ("no
 * error tracking / APM"). `onRequestError` is a native, stable (since Next
 * 15) hook — no new dependency, no external account, no CSP change, and no
 * PII risk beyond what's already in a server log line.
 *
 * Two sinks, deliberately separate:
 *
 *   1. A structured console.error — always on, and the durable record. Every
 *      unhandled server error already reached Vercel's function logs; this
 *      just gives it the consistent, greppable shape used everywhere else.
 *   2. An outbound alert (lib/observability/alert.ts) — off until
 *      ERROR_ALERT_WEBHOOK_URL is set, and the part that actually pages
 *      someone rather than waiting to be discovered.
 *
 * This still is not a full error *tracker*: no dashboard, no grouping, no
 * history beyond log retention. That part genuinely needs a vendor account,
 * and adding @sentry/nextjs later is additive — this hook keeps its shape.
 *
 * Same structured-log convention already used for checkout/email/upload
 * failures (`console.error("[scope] EVENT", {...})`) — no new logging
 * framework.
 *
 * PII: `request.headers` deliberately never reaches this log — it can carry
 * session cookies and auth headers. Only the request path/method and Next's
 * own routing context (never user-supplied) are recorded.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error);
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;

  console.error("[server] UNHANDLED_REQUEST_ERROR", {
    message,
    digest,
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });

  // Awaited, not fire-and-forget: on a serverless platform the instance can
  // be frozen the moment the response is sent, and an un-awaited fetch is
  // simply never delivered. sendErrorAlert is a no-op without a configured
  // webhook, bounded by a 2s timeout, and never throws — so awaiting it
  // cannot turn an error into a worse one or hang the handler.
  await sendErrorAlert({
    message,
    digest,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
  });
};
