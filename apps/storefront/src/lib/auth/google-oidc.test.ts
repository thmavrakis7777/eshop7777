import { describe, it, expect } from "vitest";
import {
  DEVELOPMENT_REDIRECT_URI,
  GoogleSignInError,
  PRODUCTION_REDIRECT_URI,
  buildAuthorizationUrl,
  decodeFlowCookie,
  encodeFlowCookie,
  googleRedirectUri,
  isRequestOnRedirectHost,
  loginErrorPath,
  pkceChallenge,
  randomToken,
  safeEqual,
  verifyIdTokenClaims,
} from "./google-oidc";

// CHECKOUT_PREFILL_GOOGLE_SPEC.md §3 — every rule "Συνέχεια με Google"
// relies on, without a network or a database.

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const NONCE = "n".repeat(43);
const NOW = 1_800_000_000;

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const idToken = (claims: Record<string, unknown>) =>
  `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url(claims)}.signature-not-checked`;
const validClaims = {
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  sub: "110169484474386276334",
  exp: NOW + 3600,
  nonce: NONCE,
  email: "maria@example.com",
  email_verified: true,
  given_name: "Μαρία",
  family_name: "Παπαδάκη",
};
const verify = (claims: Record<string, unknown>) =>
  verifyIdTokenClaims(idToken(claims), { clientId: CLIENT_ID, nonce: NONCE, nowSeconds: NOW });
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return err instanceof GoogleSignInError ? err.code : "other";
  }
  return "none";
};

describe("callback address", () => {
  it("is the exact URI registered in Google Cloud Console, per environment", () => {
    expect(googleRedirectUri("production")).toBe("https://www.mavrakishome.gr/api/auth/google/callback");
    expect(googleRedirectUri("development")).toBe("http://localhost:3000/api/auth/google/callback");
    expect(googleRedirectUri(undefined)).toBe(DEVELOPMENT_REDIRECT_URI);
  });

  it("only lets a sign-in start on the host Google returns to", () => {
    expect(isRequestOnRedirectHost("www.mavrakishome.gr", PRODUCTION_REDIRECT_URI)).toBe(true);
    expect(isRequestOnRedirectHost("WWW.MAVRAKISHOME.GR", PRODUCTION_REDIRECT_URI)).toBe(true);
    expect(isRequestOnRedirectHost("eshop7777-abc123.vercel.app", PRODUCTION_REDIRECT_URI)).toBe(false);
    expect(isRequestOnRedirectHost("mavrakishome.gr", PRODUCTION_REDIRECT_URI)).toBe(false);
    expect(isRequestOnRedirectHost("localhost:3000", DEVELOPMENT_REDIRECT_URI)).toBe(true);
    expect(isRequestOnRedirectHost("localhost:3001", DEVELOPMENT_REDIRECT_URI)).toBe(false);
    expect(isRequestOnRedirectHost(null, DEVELOPMENT_REDIRECT_URI)).toBe(false);
  });
});

describe("PKCE, state and nonce", () => {
  it("computes the S256 challenge (RFC 7636 Appendix B test vector)", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("makes fresh, URL-safe, 256-bit tokens", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });

  it("compares in constant time and handles different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "abc")).toBe(false);
  });

  it("builds the authorization request with every required parameter", () => {
    const url = new URL(
      buildAuthorizationUrl({ clientId: CLIENT_ID, redirectUri: PRODUCTION_REDIRECT_URI, state: "S", nonce: "N", codeChallenge: "C" })
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: CLIENT_ID,
      redirect_uri: PRODUCTION_REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      state: "S",
      nonce: "N",
      code_challenge: "C",
      code_challenge_method: "S256",
      prompt: "select_account",
    });
  });
});

describe("flow cookie", () => {
  const flow = { state: randomToken(), verifier: randomToken(), nonce: randomToken(), redirectTo: "/checkout" };

  it("round-trips", () => {
    expect(decodeFlowCookie(encodeFlowCookie(flow))).toEqual(flow);
  });

  it("rejects missing, garbled or incomplete cookies", () => {
    expect(decodeFlowCookie(undefined)).toBeNull();
    expect(decodeFlowCookie("not-base64-json")).toBeNull();
    expect(decodeFlowCookie(Buffer.from(JSON.stringify({ state: "short" })).toString("base64url"))).toBeNull();
  });

  it("never hands back an off-site destination", () => {
    expect(decodeFlowCookie(encodeFlowCookie({ ...flow, redirectTo: "//evil.example.com" }))?.redirectTo).toBe("/logariasmos");
  });
});

describe("verifyIdTokenClaims", () => {
  it("accepts a valid token and returns the profile", () => {
    expect(verify(validClaims)).toEqual({
      subject: "110169484474386276334",
      email: "maria@example.com",
      givenName: "Μαρία",
      familyName: "Παπαδάκη",
    });
  });

  it("accepts both issuer spellings Google documents, and the old string email_verified", () => {
    expect(codeOf(() => verify({ ...validClaims, iss: "accounts.google.com" }))).toBe("none");
    expect(codeOf(() => verify({ ...validClaims, email_verified: "true" }))).toBe("none");
  });

  it("refuses an unverified Google email — it's what accounts are linked by", () => {
    expect(codeOf(() => verify({ ...validClaims, email_verified: false }))).toBe("unverified");
    expect(codeOf(() => verify({ ...validClaims, email_verified: "false" }))).toBe("unverified");
    expect(codeOf(() => verify({ ...validClaims, email_verified: undefined }))).toBe("unverified");
  });

  it("refuses a token meant for someone else", () => {
    expect(codeOf(() => verify({ ...validClaims, iss: "https://evil.example.com" }))).toBe("failed");
    expect(codeOf(() => verify({ ...validClaims, aud: "other-client" }))).toBe("failed");
    expect(codeOf(() => verify({ ...validClaims, aud: [CLIENT_ID, "other-client"] }))).toBe("failed");
    expect(codeOf(() => verify({ ...validClaims, aud: [CLIENT_ID, "other-client"], azp: CLIENT_ID }))).toBe("none");
  });

  it("refuses an expired token, allowing a minute of clock difference", () => {
    expect(codeOf(() => verify({ ...validClaims, exp: NOW - 120 }))).toBe("failed");
    expect(codeOf(() => verify({ ...validClaims, exp: NOW - 30 }))).toBe("none");
  });

  it("refuses a token from a different sign-in (nonce)", () => {
    expect(codeOf(() => verify({ ...validClaims, nonce: "x".repeat(43) }))).toBe("failed");
    expect(codeOf(() => verify({ ...validClaims, nonce: undefined }))).toBe("failed");
  });

  it("refuses malformed tokens and tokens without a usable email", () => {
    expect(codeOf(() => verifyIdTokenClaims("abc", { clientId: CLIENT_ID, nonce: NONCE, nowSeconds: NOW }))).toBe("failed");
    expect(codeOf(() => verifyIdTokenClaims("a.!!!.c", { clientId: CLIENT_ID, nonce: NONCE, nowSeconds: NOW }))).toBe("failed");
    expect(codeOf(() => verify({ ...validClaims, email: undefined }))).toBe("failed");
    expect(codeOf(() => verify({ ...validClaims, sub: "" }))).toBe("failed");
  });
});

describe("loginErrorPath", () => {
  it("keeps where the customer was headed", () => {
    expect(loginErrorPath("cancelled", "/checkout")).toBe("/logariasmos/eisodos?google=cancelled&redirectTo=%2Fcheckout");
    expect(loginErrorPath("failed", "/logariasmos")).toBe("/logariasmos/eisodos?google=failed");
    expect(loginErrorPath("failed", "//evil.example.com")).toBe("/logariasmos/eisodos?google=failed");
  });
});
