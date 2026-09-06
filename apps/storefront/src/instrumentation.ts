import type { Instrumentation } from "next";

/**
 * The safe, zero-dependency baseline for #15 of the production audit ("no
 * error tracking / APM"). `onRequestError` is a native, stable (since Next
 * 15) hook — no new dependency, no external account, no CSP change, and no
 * PII risk beyond what's already in a server log line.
 *
 * This does not replace a real error-tracking service (Sentry or similar):
 * it has no dashboard, no alerting, and no history beyond whatever log
 * retention the deployment platform keeps. It gives genuine, immediate
 * visibility today — every unhandled server-side error already reaches
 * Vercel's function logs, just without this consistent, greppable shape —
 * without requiring credentials this session cannot create. See
 * PROJECT_AUDIT.md for the external setup a full tracker would need.
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
};
