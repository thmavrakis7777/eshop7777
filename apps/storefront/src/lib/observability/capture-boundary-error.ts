/**
 * Reports an error caught by one of the app's React error boundaries
 * (error.tsx / global-error.tsx) to Sentry.
 *
 * Why the boundaries need this at all: Sentry's automatic capture hooks
 * window.onerror and unhandled rejections, but an error a React boundary
 * catches is handled — it never reaches either. Without an explicit report,
 * exactly the errors that break a page for a visitor would be the ones Sentry
 * never sees.
 *
 * Errors carrying a `digest` are skipped on purpose. A digest means the error
 * was thrown on the server; the browser only ever receives a sanitised
 * placeholder message, so a report from here would have no useful stack. The
 * real one is already recorded server-side by instrumentation.ts's
 * onRequestError (log line + ERROR_ALERT_WEBHOOK_URL), keyed by that same
 * digest. Errors thrown in the browser never have one.
 *
 * Why this module never imports @sentry/nextjs itself. Every error.tsx is
 * also part of its route's server bundle, and importing the SDK from here was
 * measured to cost real weight either way it was tried: a lazy `import()`
 * inside useEffect still got traced into every storefront and admin server
 * function, and in the browser it emitted a second, separately bundled copy
 * of the SDK instead of reusing the one already loaded. So the dependency is
 * inverted: src/instrumentation-client.ts — the one place the SDK is loaded —
 * registers a reporter here right after Sentry.init, and the boundaries call
 * through it. One SDK instance, no extra download when an error happens, and
 * nothing Sentry-related in any server bundle.
 *
 * The reporter lives on globalThis rather than in a module variable so that
 * it does not depend on instrumentation-client.ts and the route chunks
 * sharing a single instance of this module. A monitoring path that silently
 * stops working if a bundler ever splits them is worse than one namespaced
 * global.
 */

export type ErrorBoundaryName = "storefront" | "admin" | "root";

type BoundaryErrorReporter = (error: Error, boundary: ErrorBoundaryName) => void;

const REPORTER_KEY = "__mavrakisHomeBoundaryErrorReporter";

type ReporterHost = typeof globalThis & { [REPORTER_KEY]?: BoundaryErrorReporter };

/**
 * Builds the reporter from Sentry's captureException. Kept here, taking the
 * function as an argument, so the exact event shape the boundaries produce is
 * unit-tested without loading the SDK.
 */
export function sentryBoundaryReporter(
  captureException: (exception: unknown, captureContext: { tags: Record<string, string> }) => unknown
): BoundaryErrorReporter {
  return (error, boundary) => {
    // The tag says which boundary caught it; the page URL, browser and
    // breadcrumbs are attached by the SDK itself.
    captureException(error, { tags: { error_boundary: boundary } });
  };
}

/** Called once, by src/instrumentation-client.ts, right after Sentry.init. */
export function registerBoundaryErrorReporter(reporter: BoundaryErrorReporter): void {
  (globalThis as ReporterHost)[REPORTER_KEY] = reporter;
}

export function captureBoundaryError(error: Error & { digest?: string }, boundary: ErrorBoundaryName): void {
  if (error.digest) return;

  try {
    // Undefined until Sentry has been initialised — with no DSN configured
    // this is simply a no-op.
    (globalThis as ReporterHost)[REPORTER_KEY]?.(error, boundary);
  } catch {
    // Reporting must never throw inside an error boundary — that would
    // replace a rendered fallback with a second, unhandled failure.
  }
}
