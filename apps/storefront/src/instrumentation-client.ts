import { getSentryClientOptions } from "@/lib/observability/sentry-client-options";
import { startSentryAfterLoad } from "@/lib/observability/deferred-sentry";

/**
 * Browser error tracking — Sentry, loaded after the page has finished
 * loading (lib/observability/deferred-sentry.ts). Next runs this file ahead
 * of hydration; what runs here now is only a pair of listeners that hold any
 * early error until the SDK arrives and reports it — the SDK itself (~29 KB
 * gzipped) is fetched as a separate chunk once the first screen is done, so
 * it no longer delays it.
 *
 * Scope is browser errors only. Server errors keep their own pipeline in
 * instrumentation.ts (structured log + ERROR_ALERT_WEBHOOK_URL), untouched.
 *
 * Once initialised, captured automatically:
 *   - uncaught exceptions and unhandled promise rejections anywhere on the
 *     page (event handlers, timers, async code), with stack traces — and
 *     those from before it loaded, replayed from the queue;
 *   - render errors caught by React error boundaries — those never reach
 *     window.onerror, so each error.tsx / global-error.tsx reports its own
 *     through lib/observability/capture-boundary-error.ts, via the reporter
 *     registered once the SDK is ready (queued until then).
 * Each event carries the page URL, browser and OS, and a breadcrumb trail
 * (navigations, clicks, network requests, console output) leading up to it,
 * from the moment the SDK started.
 *
 * Every decision — when to initialise at all, what to leave out — lives in
 * getSentryClientOptions, where it is unit-tested. This file only wires it.
 *
 * Deliberately no `onRouterTransitionStart` export, although `next build`
 * can print an "ACTION REQUIRED" note asking for one. That hook only feeds
 * Sentry's navigation performance tracing, which is intentionally off (see
 * EXCLUDED_DEFAULT_INTEGRATIONS). Errors thrown during or after a navigation
 * are captured without it.
 */
try {
  const options = getSentryClientOptions({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    nodeEnv: process.env.NODE_ENV,
    pageOrigin: window.location.origin,
  });
  if (options) {
    // Through sentry-sdk.ts, not "@sentry/nextjs" itself: only init and
    // captureException, so the chunk stays small (see that file).
    startSentryAfterLoad(options, () => import("@/lib/observability/sentry-sdk"));
  }
} catch {
  // Monitoring must never be the reason a page fails to hydrate.
}
