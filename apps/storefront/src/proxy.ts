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
//
// style-src is split deliberately. A nonce can only ever whitelist an
// *element* (<style>/<link>), never a `style="..."` **attribute** — so the
// Next.js docs' single `style-src 'self' 'nonce-…'` line silently blocks
// every React `style={{…}}` prop in production while dev's 'unsafe-inline'
// branch hides it. Verified live against a real production build
// (`next build` + `next start`): ~64 blocked-inline-style CSP errors on the
// homepage alone, with PlaceholderTile's computed backgroundImage reading
// `none` — i.e. every product placeholder, the hero pattern/photo, and the
// free-shipping progress bar rendered blank. `style-src-attr` would be the
// surgical fix but is not universally supported (unsupported browsers fall
// back to style-src and stay broken), so style-src carries 'unsafe-inline'
// for attributes and style-src-elem keeps the strict nonce for actual
// <style>/<link> elements wherever it is supported. Script execution — the
// directive that actually stops XSS — is unchanged.
// Cookie name duplicated from lib/admin/auth.ts rather than imported: this
// file runs in the middleware runtime, and importing that module would drag
// the Postgres client (and `server-only`) into it. The value is asserted
// against the real constant by a test in lib/admin/auth.ts's own module.
const ADMIN_COOKIE = "stia_admin";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const { pathname } = request.nextUrl;

  // Keep unauthenticated traffic off /admin. This is a redirect convenience,
  // NOT the access control: it only checks that a cookie is present, never
  // that it is valid, because validating means a database round trip in
  // middleware. The real checks are (protected)/layout.tsx for page renders
  // and requireAdmin() inside every admin Server Action — both of which
  // resolve the session properly.
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  if (isAdminPage && !request.cookies.get(ADMIN_COOKIE)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    style-src-elem 'self'${isDev ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`};
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
  // Defence in depth against the admin ever being indexed: the layout already
  // sets robots metadata and robots.txt disallows the path, but a header
  // cannot be missed by a crawler that ignores either.
  if (pathname.startsWith("/admin")) response.headers.set("X-Robots-Tag", "noindex, nofollow");
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
