import { sentryIngestOrigin } from "@/lib/observability/sentry-csp";

/**
 * The browser Sentry configuration, as a pure function so every decision in
 * it is unit-tested (sentry-client-options.test.ts) instead of only being
 * observable in a deployed browser. src/instrumentation-client.ts passes the
 * result straight to Sentry.init.
 */

/**
 * Default integrations removed on purpose. Both are on by default in
 * @sentry/nextjs 10.74, and neither is needed to capture errors:
 *
 *   - BrowserTracing — performance monitoring. @sentry/nextjs adds it even
 *     when no tracesSampleRate is set, and it is not passive: it wraps
 *     fetch/XHR to attach `sentry-trace`/`baggage` headers to this site's own
 *     requests (Server Actions included) and registers web-vitals observers
 *     on every page. Real-user Core Web Vitals already come from Vercel Speed
 *     Insights, so it would duplicate that at a cost.
 *   - BrowserSession — release-health sessions. Sends a request to Sentry on
 *     every page view, error or not: per-visitor traffic and a per-visit
 *     record, for a crash-free-sessions percentage email alerts do not use.
 *
 * Everything else stays, including GlobalHandlers (uncaught errors and
 * unhandled rejections), BrowserApiErrors (stacks through timers and event
 * listeners), Breadcrumbs, LinkedErrors, Dedupe and HttpContext (page URL,
 * browser, OS).
 */
export const EXCLUDED_DEFAULT_INTEGRATIONS: ReadonlySet<string> = new Set(["BrowserTracing", "BrowserSession"]);

export function withoutExcludedIntegrations<T extends { name: string }>(defaults: T[]): T[] {
  return defaults.filter((integration) => !EXCLUDED_DEFAULT_INTEGRATIONS.has(integration.name));
}

export function getSentryClientOptions({
  dsn,
  nodeEnv,
  pageOrigin,
}: {
  dsn: string | undefined;
  nodeEnv: string | undefined;
  pageOrigin: string;
}) {
  // Production builds only. `next dev` never reports, even with a DSN present
  // locally: a development error is not a production incident, and each one
  // could otherwise become an email.
  if (nodeEnv !== "production") return null;

  // The same check src/proxy.ts uses to add the ingest origin to connect-src.
  // If the policy would not allow this DSN's host, the SDK stays off instead
  // of running and having every report silently CSP-blocked.
  if (!sentryIngestOrigin(dsn)) return null;

  return {
    dsn: dsn?.trim(),
    // No cookies, no user IP: with this off the SDK also tells Sentry
    // `infer_ip: "never"`, so no visitor IP address is stored for an event.
    sendDefaultPii: false,
    // Performance monitoring stays off: no tracesSampleRate, and the tracing
    // integration is removed. Session Replay is never configured.
    integrations: withoutExcludedIntegrations,
    // Only errors whose stack points at this site's own scripts. Drops the
    // noise that would otherwise turn into email alerts nobody can act on:
    // browser extensions (chrome-extension://…) and the third-party tags
    // loaded after consent (googletagmanager.com, connect.facebook.net,
    // clarity.ms).
    allowUrls: [pageOrigin],
  };
}
