import { describe, it, expect } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/content-security-policy";

/**
 * The policy is now one fixed header (PAGE_CACHING_SPEC.md, B1). Two ways it
 * could break the shop without any error on the page: a nonce sneaking back
 * in (pages uncacheable again, or every script blocked on a cached page that
 * has no matching nonce), and an analytics script host missing now that
 * 'strict-dynamic' no longer vouches for it.
 */

const base = { isDev: false, supabaseImageOrigin: null, sentryConnectOrigin: null };
const directive = (policy: string, name: string) =>
  policy.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("buildContentSecurityPolicy", () => {
  it("has no nonce and no strict-dynamic, so a cached page's scripts still run", () => {
    const policy = buildContentSecurityPolicy(base);
    expect(policy).not.toMatch(/nonce-/);
    expect(policy).not.toMatch(/strict-dynamic/);
    expect(directive(policy, "script-src")).toContain("'unsafe-inline'");
  });

  it("lists the script host of every analytics snippet in AnalyticsScripts.tsx", () => {
    const scriptSrc = directive(buildContentSecurityPolicy(base), "script-src");
    for (const host of [
      "https://www.googletagmanager.com",
      "https://connect.facebook.net",
      "https://www.clarity.ms",
      "https://scripts.clarity.ms",
    ]) {
      expect(scriptSrc).toContain(host);
    }
  });

  it("allows eval only in development", () => {
    expect(buildContentSecurityPolicy(base)).not.toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ ...base, isDev: true })).toContain("'unsafe-eval'");
  });

  it("adds the image and Sentry origins only when configured", () => {
    const without = buildContentSecurityPolicy(base);
    expect(without).not.toContain("undefined");
    expect(without).not.toContain("null");

    const withBoth = buildContentSecurityPolicy({
      ...base,
      supabaseImageOrigin: "https://abc.supabase.co",
      sentryConnectOrigin: "https://o1.ingest.de.sentry.io",
    });
    expect(directive(withBoth, "img-src")).toContain("https://abc.supabase.co");
    expect(directive(withBoth, "connect-src")).toContain("https://o1.ingest.de.sentry.io");
  });

  it("keeps the framing and form protections", () => {
    const policy = buildContentSecurityPolicy(base);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("form-action 'self'");
  });
});
