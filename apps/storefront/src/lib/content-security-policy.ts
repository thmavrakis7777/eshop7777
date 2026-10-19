/**
 * The site's Content-Security-Policy: one fixed header for every response,
 * set in next.config.ts `headers()`.
 *
 * Until 2026-10-19 this was built per request in src/proxy.ts around a fresh
 * nonce (`script-src 'nonce-…' 'strict-dynamic'`). A nonce must differ on
 * every response, so every page had to render per request and nothing could
 * be cached; with Vercel's Hobby CPU allowance nearly used up, the owner
 * chose a fixed policy so pages can be served from the CDN
 * (PAGE_CACHING_SPEC.md, B1). This is Next's documented "Without Nonces"
 * policy (guides/content-security-policy.md).
 *
 * What that costs: `script-src` now carries 'unsafe-inline', so an injected
 * inline script would run. The injection surface is small: React escapes
 * text, RichBody turns admin text into React elements (no HTML string
 * anywhere), and the storefront's only `dangerouslySetInnerHTML` is JSON-LD
 * through safeJsonLd. Analytics IDs are format-validated on save and
 * JSON-encoded where they are interpolated (settings-actions.ts,
 * AnalyticsScripts.tsx).
 *
 * Without 'strict-dynamic', scripts that the analytics snippets insert are
 * no longer trusted through the nonce'd snippet that created them, so each
 * provider's script host is listed explicitly. These are the hosts the four
 * snippets in AnalyticsScripts.tsx load from, and nothing speculative. A GTM
 * container that later loads other vendors' tags needs those hosts added
 * here, or the browser will block them.
 *
 * Every other directive is carried over unchanged from the nonce policy,
 * including the GA4 regional hosts and www.facebook.com/tr that proxy.ts's
 * old comment records were only found by watching the network tab.
 * style-src keeps 'unsafe-inline' for React `style={{…}}` attributes, as
 * before; `style-src-elem` lost its nonce and so is simply dropped, which
 * lets style-src cover <style> elements too.
 */
export function buildContentSecurityPolicy(options: {
  isDev: boolean;
  /** Supabase Storage origin for product photos, or null when unset. */
  supabaseImageOrigin: string | null;
  /** Sentry ingest origin (lib/observability/sentry-csp.ts), or null. */
  sentryConnectOrigin: string | null;
}): string {
  const { isDev, supabaseImageOrigin, sentryConnectOrigin } = options;
  const directives = [
    "default-src 'self'",
    [
      "script-src 'self' 'unsafe-inline'",
      isDev ? "'unsafe-eval'" : "",
      "https://www.googletagmanager.com",
      "https://connect.facebook.net",
      "https://www.clarity.ms",
      "https://scripts.clarity.ms",
    ],
    "style-src 'self' 'unsafe-inline'",
    [
      "img-src 'self' blob: data: https://www.google-analytics.com https://www.facebook.com",
      supabaseImageOrigin ?? "",
    ],
    [
      "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com",
      "https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com",
      "https://www.clarity.ms https://c.clarity.ms",
      sentryConnectOrigin ?? "",
    ],
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
  return directives
    .map((d) => (Array.isArray(d) ? d.filter(Boolean).join(" ") : d))
    .join("; ");
}
