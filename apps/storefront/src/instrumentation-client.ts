import * as Sentry from "@sentry/nextjs";
import { registerBoundaryErrorReporter, sentryBoundaryReporter } from "@/lib/observability/capture-boundary-error";
import { getSentryClientOptions } from "@/lib/observability/sentry-client-options";

/**
 * Browser error tracking — Sentry, initialised before React hydrates. Next
 * runs this file ahead of hydration, so errors thrown while the page first
 * becomes interactive are caught too, not only later ones.
 *
 * Scope is browser errors only. Server errors keep their own pipeline in
 * instrumentation.ts (structured log + ERROR_ALERT_WEBHOOK_URL), untouched.
 *
 * Once initialised, captured automatically:
 *   - uncaught exceptions and unhandled promise rejections anywhere on the
 *     page (event handlers, timers, async code), with stack traces;
 *   - render errors caught by React error boundaries — those never reach
 *     window.onerror, so each error.tsx / global-error.tsx reports its own
 *     through lib/observability/capture-boundary-error.ts, via the reporter
 *     registered below.
 * Each event carries the page URL, browser and OS, and a breadcrumb trail
 * (navigations, clicks, network requests, console output) leading up to it.
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
    Sentry.init(options);
    // The error boundaries report through this rather than importing the SDK
    // themselves — see capture-boundary-error.ts for why.
    registerBoundaryErrorReporter(sentryBoundaryReporter(Sentry.captureException));
  }
} catch {
  // Monitoring must never be the reason a page fails to hydrate.
}
