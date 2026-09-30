import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { isSafeRedirectPath, isValidEmail } from "@/lib/checkout-validation";

// "Συνέχεια με Google" — the protocol half, as plain functions so every rule
// can be unit tested (google-oidc.test.ts). Standard OpenID Connect
// Authorization Code flow with PKCE, state and nonce, run entirely on the
// server: no Google script on any page, no Identity Platform
// (CHECKOUT_PREFILL_GOOGLE_SPEC.md §3.1). lib/auth/google.ts holds the
// secrets and the network call; the two routes under app/api/auth/google
// wire it together.

export const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
// Name and email only — nothing that would need Google's app review.
export const GOOGLE_SCOPES = "openid email profile";
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
// Tolerated clock difference between this server and Google, in seconds.
const CLOCK_SKEW_SECONDS = 60;

// The exact callback addresses registered in Google Cloud Console. Pinned,
// not built from NEXT_PUBLIC_SITE_URL: that setting falls back to Vercel's
// per-deployment URL when unset (lib/site-config.ts), which Google would
// reject with redirect_uri_mismatch. Every other address of the shop
// (mavrakishome.gr, mavrakishome.com, www.mavrakishome.com) 308-redirects
// to www.mavrakishome.gr, so a customer is always on this host.
export const PRODUCTION_REDIRECT_URI = "https://www.mavrakishome.gr/api/auth/google/callback";
export const DEVELOPMENT_REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";

export function googleRedirectUri(nodeEnv: string | undefined): string {
  return nodeEnv === "production" ? PRODUCTION_REDIRECT_URI : DEVELOPMENT_REDIRECT_URI;
}

/**
 * Whether the request is on the host Google will send the customer back
 * to. The flow cookie is host-only, so starting anywhere else (a Vercel
 * preview URL, the dev server on another port, a phone on the LAN IP) can
 * only end in a failed callback — or Google's own redirect_uri_mismatch
 * page. The start route refuses early with a clear message instead.
 */
export function isRequestOnRedirectHost(requestHost: string | null, redirectUri: string): boolean {
  return Boolean(requestHost) && requestHost!.toLowerCase() === new URL(redirectUri).host;
}

/** 256 bits from the CSPRNG, URL-safe — for state, nonce and the PKCE verifier. */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** PKCE S256 (RFC 7636 §4.2): BASE64URL(SHA256(verifier)). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Constant-time string comparison, so a state/nonce check leaks no timing. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function buildAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    // Always show the account chooser — on a shared computer the customer
    // picks who they are instead of silently getting whoever is signed in.
    prompt: "select_account",
  });
  return `${GOOGLE_AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// The flow cookie: what the callback needs to check that it's finishing the
// same sign-in this browser started. httpOnly, host-only, 10 minutes, single
// use (the callback clears it before anything else).
// ---------------------------------------------------------------------------

export type GoogleFlow = { state: string; verifier: string; nonce: string; redirectTo: string };

const flowSchema = z.object({
  state: z.string().min(32).max(128),
  verifier: z.string().min(43).max(128),
  nonce: z.string().min(32).max(128),
  redirectTo: z.string().max(512),
});

export function encodeFlowCookie(flow: GoogleFlow): string {
  return Buffer.from(JSON.stringify(flow)).toString("base64url");
}

export function decodeFlowCookie(value: string | undefined): GoogleFlow | null {
  if (!value) return null;
  try {
    const parsed = flowSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (!parsed.success) return null;
    // Re-validated on the way out too, never trusted just because it was
    // validated on the way in.
    return isSafeRedirectPath(parsed.data.redirectTo) ? parsed.data : { ...parsed.data, redirectTo: "/logariasmos" };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The ID token.
// ---------------------------------------------------------------------------

export type GoogleSignInErrorCode = "cancelled" | "failed" | "unverified" | "unavailable" | "rate_limited";

export class GoogleSignInError extends Error {
  constructor(public readonly code: GoogleSignInErrorCode, message: string) {
    super(message);
  }
}

/**
 * Where a failed or cancelled sign-in lands: the login page, saying what
 * happened (its message table is in logariasmos/(auth)/eisodos/page.tsx),
 * still offering both ways in, and still carrying where the customer was
 * headed — so a shopper from checkout can sign in with email instead, or go
 * back and check out as a guest.
 */
export function loginErrorPath(code: GoogleSignInErrorCode, redirectTo: string): string {
  const params = new URLSearchParams({ google: code });
  if (isSafeRedirectPath(redirectTo) && redirectTo !== "/logariasmos") params.set("redirectTo", redirectTo);
  return `/logariasmos/eisodos?${params.toString()}`;
}

export type GoogleProfile = {
  subject: string;
  email: string;
  givenName: string;
  familyName: string;
};

const claimsSchema = z.object({
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
  azp: z.string().optional(),
  sub: z.string().min(1).max(255),
  exp: z.number(),
  nonce: z.string().optional(),
  email: z.string().optional(),
  // Google sends a boolean; older tokens sent the string "true".
  email_verified: z.union([z.boolean(), z.string()]).optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
});

/**
 * Checks the ID token the callback got back from Google's token endpoint.
 *
 * The signature is deliberately not verified: the token comes straight
 * from Google over TLS, in answer to a request authenticated with the
 * client secret — OpenID Connect Core §3.1.3.7 allows TLS server validation
 * in place of the signature exactly then, and Google's own OpenID Connect
 * guide says the same. It is never accepted from the browser. Every claim
 * that matters is still checked: issuer, audience, expiry, and the nonce
 * this browser's flow cookie holds (which ties the token to this sign-in).
 *
 * Only a Google-verified email is accepted (§3.2): it's what an existing
 * account is linked by, so an unverified one could hand someone else's
 * account over.
 */
export function verifyIdTokenClaims(
  idToken: string,
  expected: { clientId: string; nonce: string; nowSeconds: number }
): GoogleProfile {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new GoogleSignInError("failed", "ID token is not a JWT");

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new GoogleSignInError("failed", "ID token payload is not JSON");
  }
  const parsed = claimsSchema.safeParse(payload);
  if (!parsed.success) throw new GoogleSignInError("failed", "ID token claims are malformed");
  const claims = parsed.data;

  if (!GOOGLE_ISSUERS.has(claims.iss)) throw new GoogleSignInError("failed", "Unexpected issuer");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(expected.clientId)) throw new GoogleSignInError("failed", "Unexpected audience");
  if (audiences.length > 1 && claims.azp !== expected.clientId) {
    throw new GoogleSignInError("failed", "Unexpected authorized party");
  }
  if (claims.exp + CLOCK_SKEW_SECONDS <= expected.nowSeconds) throw new GoogleSignInError("failed", "ID token expired");
  if (!claims.nonce || !safeEqual(claims.nonce, expected.nonce)) throw new GoogleSignInError("failed", "Nonce mismatch");

  const email = claims.email?.trim() ?? "";
  if (!isValidEmail(email)) throw new GoogleSignInError("failed", "ID token has no usable email");
  const verified = claims.email_verified === true || claims.email_verified === "true";
  if (!verified) throw new GoogleSignInError("unverified", "Google email is not verified");

  return {
    subject: claims.sub,
    email,
    givenName: claims.given_name?.trim() ?? "",
    familyName: claims.family_name?.trim() ?? "",
  };
}
