/**
 * Derives the one Content-Security-Policy source the Sentry browser SDK
 * needs — its ingest origin, for connect-src — from the public DSN.
 *
 * Shared by src/proxy.ts (which adds the origin to the policy) and
 * lib/observability/sentry-client-options.ts (which only initialises the SDK
 * when this returns a value). One validation for both means the SDK is never
 * switched on for a DSN the policy would then silently block — the exact
 * "script ran, request CSP-blocked" failure proxy.ts's header comment
 * documents for GA4 and the Meta Pixel.
 *
 * Deliberately dependency-free: proxy.ts runs in the middleware runtime and
 * must not pull the Sentry SDK (or anything server-only) into it.
 */

/**
 * Characters a CSP host-source can carry without ambiguity. A WHATWG URL
 * hostname may legally contain characters such as `;`, which inside a policy
 * string would end the directive — so the parsed hostname is checked against
 * this rather than trusted to be header-safe. Same defence-in-depth stance as
 * AnalyticsScripts.tsx's `js()`: a configured value is still validated at the
 * point it is interpolated.
 */
const SAFE_HOSTNAME = /^[a-z0-9.-]+$/;

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export function sentryIngestOrigin(dsn: string | undefined): string | null {
  // .trim(): a value pasted into Vercel's dashboard can carry a trailing
  // newline — the same confirmed-live failure mode lib/storage/urls.ts guards.
  const trimmed = dsn?.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!SAFE_HOSTNAME.test(url.hostname)) return null;

  // https only, with one exception: plain http to a loopback host, which is
  // how the integration is verified locally against a stand-in ingest without
  // sending anything to a real Sentry project. A non-TLS *remote* ingest can
  // never make it into the policy.
  const isLoopbackHttp = url.protocol === "http:" && LOOPBACK_HOSTNAMES.has(url.hostname);
  if (url.protocol !== "https:" && !isLoopbackHttp) return null;

  // .origin drops the DSN's public key (the userinfo part) and its project
  // path, leaving exactly scheme://host[:port] — never the key itself.
  return url.origin;
}
