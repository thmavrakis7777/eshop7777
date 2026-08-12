import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Real CSP with per-request nonces — the baseline headers in next.config.ts
// (nosniff, X-Frame-Options, etc.) don't vary per request, but a nonce must
// be fresh every time, which only proxy.ts (server-side, runs before every
// request) can do. Every route here is already dynamically rendered
// (cookies() in RootLayout for the cart), so this doesn't newly opt anything
// out of static generation — only /robots.txt and /sitemap.xml stay static,
// neither renders HTML or scripts, so they don't need a CSP nonce anyway.
//
// script-src uses 'strict-dynamic': a nonce'd <script> (this app's own
// bundles, plus the analytics init snippets in AnalyticsScripts.tsx) is
// trusted to load further scripts itself, which is exactly how GA4/GTM/Meta
// Pixel/Clarity's own snippets work (each creates and inserts its own
// <script src="...">) — they don't need their own nonce as long as the
// snippet that created them had one. connect-src/img-src still need each
// provider's real domain explicitly: strict-dynamic only covers script
// loading, not the XHR/beacon/pixel requests those scripts go on to make.
// Every domain below is one actually referenced in AnalyticsScripts.tsx —
// nothing speculative. All four providers are optional/admin-configured
// (see analytics-settings), so these stay in the policy whether or not a
// given store has any of them turned on.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`};
    img-src 'self' blob: data: https://www.google-analytics.com https://www.facebook.com;
    connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.clarity.ms https://c.clarity.ms;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `;
  const contentSecurityPolicyHeaderValue = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
