import "server-only";
import { NextResponse } from "next/server";
import { isSafeRedirectPath } from "@/lib/checkout-validation";
import { GOOGLE_TOKEN_ENDPOINT, GoogleSignInError, googleRedirectUri } from "@/lib/auth/google-oidc";

// "Συνέχεια με Google" — the half that holds the secret and talks to
// Google (the protocol rules are in google-oidc.ts). Both values come from
// Google Cloud Console → Google Auth Platform → Clients; neither is ever sent
// to the browser. With either missing, sign-in with Google is simply off:
// no button anywhere and the routes refuse, the same way address
// suggestions switch off without GOOGLE_PLACES_API_KEY.

export type GoogleOAuthConfig = { clientId: string; clientSecret: string; redirectUri: string };

const isProduction = process.env.NODE_ENV === "production";

// The flow cookie (google-oidc.ts). `__Host-` in production: the browser then
// only accepts it over HTTPS, for this exact host, on path "/" — no
// subdomain could ever plant or read one. Plain HTTP localhost can't use
// the prefix. SameSite=Lax is required, not just allowed: the callback is a
// top-level navigation arriving from accounts.google.com, and a Strict
// cookie would not be sent with it.
export const GOOGLE_FLOW_COOKIE = isProduction ? "__Host-stia_google_flow" : "stia_google_flow";
export const googleFlowCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60,
};

export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: googleRedirectUri(process.env.NODE_ENV) };
}

/**
 * A redirect to a page of this site, as a relative Location — valid HTTP
 * (RFC 9110 §10.2.2), and the browser resolves it against the host it is
 * already on. Not NextResponse.redirect(new URL(path, request.url)): under
 * `next dev -H 0.0.0.0` request.url reports the host as 0.0.0.0, which sent
 * the browser to http://0.0.0.0:3000 — a different host, where the session
 * cookie just set on localhost isn't sent. Found live while testing.
 */
export function redirectWithinSite(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });
}

/**
 * The button's link, or undefined when Google sign-in isn't configured.
 * `redirectTo` is where the customer lands afterwards (checkout, or the
 * account page they were headed to).
 */
export function googleSignInHref(redirectTo: string): string | undefined {
  if (!getGoogleOAuthConfig()) return undefined;
  const target = isSafeRedirectPath(redirectTo) ? redirectTo : "/logariasmos";
  return `/api/auth/google?redirectTo=${encodeURIComponent(target)}`;
}

/**
 * Trades the one-time code for tokens (the back-channel step), sending the
 * PKCE verifier so a code intercepted on its way back to us is useless on
 * its own. Only the ID token is kept; the access token is discarded, since
 * the shop never calls a Google API on the customer's behalf.
 */
export async function exchangeCodeForIdToken(config: GoogleOAuthConfig, code: string, verifier: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new GoogleSignInError("failed", `Token request failed: ${String(err)}`);
  }

  const body = (await response.json().catch(() => null)) as { id_token?: unknown; error?: unknown } | null;
  if (!response.ok || typeof body?.id_token !== "string") {
    // Google's `error` code (e.g. invalid_grant) is safe to log and is what
    // tells an expired/reused code apart from a wrong client secret.
    throw new GoogleSignInError("failed", `Token endpoint ${response.status}: ${String(body?.error ?? "no id_token")}`);
  }
  return body.id_token;
}
