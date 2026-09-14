import { describe, it, expect } from "vitest";
import { sentryIngestOrigin } from "@/lib/observability/sentry-csp";

/**
 * This function's output is interpolated straight into the production
 * Content-Security-Policy header, so both directions of failure matter: too
 * strict and every Sentry report is silently CSP-blocked, too loose and the
 * policy gains a source it should not have. These DSNs follow Sentry's real
 * formats but are not real projects.
 */

describe("sentryIngestOrigin", () => {
  it("adds nothing at all while no DSN is configured", () => {
    expect(sentryIngestOrigin(undefined)).toBeNull();
    expect(sentryIngestOrigin("")).toBeNull();
    expect(sentryIngestOrigin("   \n")).toBeNull();
  });

  it("returns exactly the ingest origin for Sentry's US and EU regions", () => {
    expect(sentryIngestOrigin("https://abc123@o4507000000000000.ingest.us.sentry.io/4508000000000000")).toBe(
      "https://o4507000000000000.ingest.us.sentry.io"
    );
    expect(sentryIngestOrigin("https://abc123@o4507000000000000.ingest.de.sentry.io/4508000000000000")).toBe(
      "https://o4507000000000000.ingest.de.sentry.io"
    );
  });

  it("never lets the DSN's public key or project path into the policy", () => {
    const origin = sentryIngestOrigin("https://publickey123@o1.ingest.de.sentry.io/42");
    expect(origin).not.toContain("publickey123");
    expect(origin).not.toContain("@");
    expect(origin).not.toContain("/42");
  });

  it("keeps a non-default port, for a self-hosted Sentry", () => {
    expect(sentryIngestOrigin("https://key@sentry.example.com:9000/1")).toBe("https://sentry.example.com:9000");
  });

  it("tolerates the trailing newline a dashboard paste can add", () => {
    expect(sentryIngestOrigin("https://key@o1.ingest.de.sentry.io/2\n")).toBe("https://o1.ingest.de.sentry.io");
  });

  it("refuses anything that is not https — except loopback, for local verification", () => {
    expect(sentryIngestOrigin("http://key@o1.ingest.de.sentry.io/2")).toBeNull();
    expect(sentryIngestOrigin("ftp://key@o1.ingest.de.sentry.io/2")).toBeNull();
    expect(sentryIngestOrigin("javascript:alert(1)")).toBeNull();
    expect(sentryIngestOrigin("not a url")).toBeNull();

    expect(sentryIngestOrigin("http://key@127.0.0.1:4600/1")).toBe("http://127.0.0.1:4600");
    expect(sentryIngestOrigin("http://key@localhost:4600/1")).toBe("http://localhost:4600");
  });

  it("rejects a hostname that could break out of the connect-src directive", () => {
    // A WHATWG URL hostname may contain `;` — inside a CSP string that ends
    // the directive and starts a new one. Must never be passed through.
    expect(sentryIngestOrigin("https://key@evil;script-src.example/1")).toBeNull();
    expect(sentryIngestOrigin("https://key@[::1]:4600/1")).toBeNull();
  });
});
