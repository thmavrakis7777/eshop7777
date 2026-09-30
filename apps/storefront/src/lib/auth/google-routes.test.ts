import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as start } from "@/app/api/auth/google/route";
import { GET as callback } from "@/app/api/auth/google/callback/route";
import { encodeFlowCookie, pkceChallenge, randomToken } from "./google-oidc";

// The two routes of "Συνέχεια με Google", up to the point where they would
// reach Google or the database. Fake client values live only in this
// process's env for the duration of each test — no real keys, no network.

const FLOW_COOKIE = "stia_google_flow"; // the non-production name
const request = (url: string, init: { host?: string; cookie?: string } = {}) =>
  new NextRequest(url, {
    headers: { host: init.host ?? new URL(url).host, ...(init.cookie ? { cookie: init.cookie } : {}) },
  });

beforeEach(() => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client.apps.googleusercontent.com";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-secret";
});
afterEach(() => {
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
});

describe("GET /api/auth/google", () => {
  it("sends the customer to Google with a matching flow cookie", async () => {
    const res = await start(request("http://localhost:3000/api/auth/google?redirectTo=%2Fcheckout"));
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/google/callback");

    const cookie = res.cookies.get(FLOW_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/");
    expect(cookie.maxAge).toBe(600);
    const flow = JSON.parse(Buffer.from(cookie.value, "base64url").toString("utf8"));
    // The URL carries the state, nonce and challenge of *this* cookie.
    expect(location.searchParams.get("state")).toBe(flow.state);
    expect(location.searchParams.get("nonce")).toBe(flow.nonce);
    expect(location.searchParams.get("code_challenge")).toBe(pkceChallenge(flow.verifier));
    expect(flow.redirectTo).toBe("/checkout");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("never carries an off-site destination into the flow", async () => {
    const res = await start(request("http://localhost:3000/api/auth/google?redirectTo=%2F%2Fevil.example.com"));
    const flow = JSON.parse(Buffer.from(res.cookies.get(FLOW_COOKIE)!.value, "base64url").toString("utf8"));
    expect(flow.redirectTo).toBe("/logariasmos");
  });

  it("refuses when not configured, without contacting Google", async () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    const res = await start(request("http://localhost:3000/api/auth/google?redirectTo=%2Fcheckout"));
    expect(res.headers.get("location")).toBe("/logariasmos/eisodos?google=unavailable&redirectTo=%2Fcheckout");
    expect(res.cookies.get(FLOW_COOKIE)).toBeUndefined();
  });

  it("refuses on a host Google won't return to (another port, a preview URL)", async () => {
    const res = await start(request("http://localhost:3001/api/auth/google"));
    expect(res.headers.get("location")).toContain("/logariasmos/eisodos?google=unavailable");
    expect(res.cookies.get(FLOW_COOKIE)).toBeUndefined();
  });
});

describe("GET /api/auth/google/callback — refused before Google or the database is reached", () => {
  const flow = { state: randomToken(), verifier: randomToken(), nonce: randomToken(), redirectTo: "/checkout" };
  const withFlow = { cookie: `${FLOW_COOKIE}=${encodeFlowCookie(flow)}` };

  const expectCleared = (res: Response) => {
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${FLOW_COOKIE}=;`);
    expect(setCookie).toMatch(/Max-Age=0/i);
  };

  it("treats Cancel on Google's page as a cancel, back to login, destination kept", async () => {
    const res = await callback(request("http://localhost:3000/api/auth/google/callback?error=access_denied", withFlow));
    expect(res.headers.get("location")).toBe("/logariasmos/eisodos?google=cancelled&redirectTo=%2Fcheckout");
    expectCleared(res);
  });

  it("refuses a callback this browser never started (no flow cookie)", async () => {
    const res = await callback(request(`http://localhost:3000/api/auth/google/callback?code=abc&state=${flow.state}`));
    expect(res.headers.get("location")).toBe("/logariasmos/eisodos?google=failed");
    expectCleared(res);
  });

  it("refuses a state that doesn't match the cookie (login CSRF)", async () => {
    const res = await callback(request("http://localhost:3000/api/auth/google/callback?code=abc&state=forged", withFlow));
    expect(res.headers.get("location")).toBe("/logariasmos/eisodos?google=failed&redirectTo=%2Fcheckout");
    expectCleared(res);
  });

  it("refuses a matching state without a code", async () => {
    const res = await callback(request(`http://localhost:3000/api/auth/google/callback?state=${flow.state}`, withFlow));
    expect(res.headers.get("location")).toContain("google=failed");
    expectCleared(res);
  });
});
