import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_FLOW_COOKIE, getGoogleOAuthConfig, googleFlowCookieOptions, redirectWithinSite } from "@/lib/auth/google";
import {
  buildAuthorizationUrl,
  encodeFlowCookie,
  isRequestOnRedirectHost,
  loginErrorPath,
  pkceChallenge,
  randomToken,
} from "@/lib/auth/google-oidc";
import { isSafeRedirectPath } from "@/lib/checkout-validation";

/**
 * "Συνέχεια με Google", step 1 (CHECKOUT_PREFILL_GOOGLE_SPEC.md §3.1): sends
 * the customer to Google's sign-in page.
 *
 * Fresh state, nonce and PKCE verifier for every attempt, kept in a short-
 * lived httpOnly cookie that only this browser holds — the callback accepts
 * nothing that doesn't match it. Reached by a plain link (GoogleSignInButton),
 * never prefetched, and a GET that changes nothing but that one cookie.
 *
 * No route segment config needed: a Route Handler reading the request is
 * dynamic by default, so this can never be cached or prerendered.
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("redirectTo");
  const redirectTo = isSafeRedirectPath(requested) ? requested : "/logariasmos";

  const config = getGoogleOAuthConfig();
  if (!config || !isRequestOnRedirectHost(request.headers.get("host"), config.redirectUri)) {
    return redirectWithinSite(loginErrorPath("unavailable", redirectTo));
  }

  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();

  const response = NextResponse.redirect(
    buildAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      nonce,
      codeChallenge: pkceChallenge(verifier),
    }),
    303
  );
  response.cookies.set(GOOGLE_FLOW_COOKIE, encodeFlowCookie({ state, verifier, nonce, redirectTo }), googleFlowCookieOptions);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
