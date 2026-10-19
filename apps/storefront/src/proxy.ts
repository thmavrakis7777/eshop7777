import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Runs only for /admin and /logariasmos (see `config.matcher` below).
//
// Until 2026-10-19 this ran before every page to build a per-request
// Content-Security-Policy around a fresh nonce. That made every page render
// per request, so nothing on the shop could be cached; the policy is now one
// fixed header set in next.config.ts (src/lib/content-security-policy.ts,
// PAGE_CACHING_SPEC.md B1). What is left here is what genuinely needs the
// request: the admin cookie redirect, the admin noindex header, and the
// x-pathname header the account layouts read. Keeping this off every other
// route also means a page served from the CDN cache costs no middleware run.

// Cookie name duplicated from lib/admin/auth.ts rather than imported: this
// file runs in the middleware runtime, and importing that module would drag
// the Postgres client (and `server-only`) into it. The value is asserted
// against the real constant by a test in lib/admin/auth.ts's own module.
const ADMIN_COOKIE = "stia_admin";

export function proxy(request: NextRequest) {
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

  const requestHeaders = new Headers(request.headers);
  // The current path (+ query), for Server Components that need it — a
  // layout has no other way to know the URL it's rendering under. Read as
  // `(await headers()).get("x-pathname")`. Used by the account area
  // (QA-013) to preserve a deep link (e.g. /logariasmos/parangelies) through
  // the login redirect instead of always bouncing to the account overview.
  requestHeaders.set("x-pathname", pathname + request.nextUrl.search);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Defence in depth against the admin ever being indexed: the layout already
  // sets robots metadata and robots.txt disallows the path, but a header
  // cannot be missed by a crawler that ignores either.
  if (pathname.startsWith("/admin")) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: [
    {
      // `:path*` also matches zero segments, so /admin and /logariasmos
      // themselves are included.
      source: "/(admin|logariasmos)/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
