import type { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_FLOW_COOKIE,
  exchangeCodeForIdToken,
  getGoogleOAuthConfig,
  googleFlowCookieOptions,
  redirectWithinSite,
} from "@/lib/auth/google";
import {
  GoogleSignInError,
  decodeFlowCookie,
  loginErrorPath,
  safeEqual,
  verifyIdTokenClaims,
  type GoogleSignInErrorCode,
} from "@/lib/auth/google-oidc";
import { checkRateLimit, rateLimitKey } from "@/lib/auth/session";
import { startCustomerSession } from "@/lib/auth/sign-in";
import { signInWithGoogle } from "@/lib/db/customer";

/**
 * "Συνέχεια με Google", step 2 — Google sends the customer back here
 * (https://www.mavrakishome.gr/api/auth/google/callback, or the localhost
 * one in development; see google-oidc.ts).
 *
 * In order, and nothing is trusted before its check passes:
 * 1. The flow cookie is read and cleared at once — single use.
 * 2. `state` must match it (the response belongs to a sign-in this browser
 *    started — stops login CSRF).
 * 3. The code is exchanged for tokens with the client secret and the PKCE
 *    verifier.
 * 4. The ID token's issuer, audience, expiry, nonce and verified email are
 *    checked (verifyIdTokenClaims).
 * 5. The customer is found, linked or created (signInWithGoogle), and gets
 *    a normal session, exactly as a password login would.
 *
 * Any failure lands on the login page with a message and both ways in still
 * offered; guest checkout is untouched either way. Rate limited like
 * password login.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const flow = decodeFlowCookie(request.cookies.get(GOOGLE_FLOW_COOKIE)?.value);
  const redirectTo = flow?.redirectTo ?? "/logariasmos";

  const fail = (code: GoogleSignInErrorCode, reason: string) => {
    if (code !== "cancelled") console.error("[google] SIGN_IN_FAILED", { code, reason });
    return clearFlow(redirectWithinSite(loginErrorPath(code, redirectTo)));
  };

  // The customer pressed "Cancel" on Google's page (or Google refused).
  const googleError = params.get("error");
  if (googleError) return fail(googleError === "access_denied" ? "cancelled" : "failed", `Google returned ${googleError}`);

  if (!flow) return fail("failed", "Missing or unreadable flow cookie");
  if (!safeEqual(params.get("state") ?? "", flow.state)) return fail("failed", "State mismatch");
  const code = params.get("code");
  if (!code) return fail("failed", "No authorization code");

  const config = getGoogleOAuthConfig();
  if (!config) return fail("unavailable", "Google sign-in is not configured");

  if (!(await checkRateLimit(await rateLimitKey("google"), 20, 900))) return fail("rate_limited", "Rate limited");

  try {
    const idToken = await exchangeCodeForIdToken(config, code, flow.verifier);
    const profile = verifyIdTokenClaims(idToken, {
      clientId: config.clientId,
      nonce: flow.nonce,
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    const customerId = await signInWithGoogle(profile);
    await startCustomerSession(customerId);
  } catch (err) {
    return fail(err instanceof GoogleSignInError ? err.code : "failed", err instanceof Error ? err.message : String(err));
  }

  // Signed in. One stop at /logariasmos/google first: the guest wishlist
  // lives in localStorage, so only the browser can merge it — the same step
  // LoginForm runs after a password login — and that page then continues
  // to where the customer was headed.
  return clearFlow(redirectWithinSite(`/logariasmos/google?${new URLSearchParams({ to: redirectTo }).toString()}`));
}

// Cleared with the same attributes it was set with — a `__Host-` cookie
// without `Secure` on the deleting Set-Cookie would be ignored by the browser.
function clearFlow(response: NextResponse): NextResponse {
  response.cookies.set(GOOGLE_FLOW_COOKIE, "", { ...googleFlowCookieOptions, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
