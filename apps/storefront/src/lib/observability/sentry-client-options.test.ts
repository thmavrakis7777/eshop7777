import { describe, it, expect } from "vitest";
import { getSentryClientOptions, withoutExcludedIntegrations } from "@/lib/observability/sentry-client-options";

/**
 * Two ways this config could fail quietly in production, both worth a test:
 * the SDK switching on when it should not (dev noise, a DSN the CSP blocks),
 * or an integration filter written too broadly and removing the very
 * integration that captures uncaught browser errors.
 */

const DSN = "https://publickey@o1.ingest.de.sentry.io/2";
const ORIGIN = "https://www.mavrakishome.gr";

/** The names @sentry/nextjs 10.74 actually registers by default in the browser. */
const DEFAULT_INTEGRATION_NAMES = [
  "EventFilters",
  "FunctionToString",
  "ConversationId",
  "BrowserApiErrors",
  "Breadcrumbs",
  "GlobalHandlers",
  "LinkedErrors",
  "Dedupe",
  "HttpContext",
  "CultureContext",
  "BrowserSession",
  "BrowserTracing",
  "NextjsClientStackFrameNormalization",
];

describe("getSentryClientOptions", () => {
  it("stays off without a DSN", () => {
    expect(getSentryClientOptions({ dsn: undefined, nodeEnv: "production", pageOrigin: ORIGIN })).toBeNull();
    expect(getSentryClientOptions({ dsn: "", nodeEnv: "production", pageOrigin: ORIGIN })).toBeNull();
  });

  it("stays off outside production builds, even with a DSN", () => {
    expect(getSentryClientOptions({ dsn: DSN, nodeEnv: "development", pageOrigin: ORIGIN })).toBeNull();
    expect(getSentryClientOptions({ dsn: DSN, nodeEnv: "test", pageOrigin: ORIGIN })).toBeNull();
  });

  it("stays off for a DSN the CSP would refuse, rather than run and be blocked", () => {
    expect(
      getSentryClientOptions({ dsn: "http://publickey@o1.ingest.de.sentry.io/2", nodeEnv: "production", pageOrigin: ORIGIN })
    ).toBeNull();
  });

  it("initialises error tracking only — no PII, no tracing, no replay", () => {
    const options = getSentryClientOptions({ dsn: `${DSN}\n`, nodeEnv: "production", pageOrigin: ORIGIN });

    expect(options).not.toBeNull();
    expect(options?.dsn).toBe(DSN);
    expect(options?.sendDefaultPii).toBe(false);
    expect(options?.allowUrls).toEqual([ORIGIN]);
    expect(options).not.toHaveProperty("tracesSampleRate");
    expect(options).not.toHaveProperty("replaysSessionSampleRate");
    expect(options).not.toHaveProperty("replaysOnErrorSampleRate");
  });
});

describe("withoutExcludedIntegrations", () => {
  const remaining = withoutExcludedIntegrations(DEFAULT_INTEGRATION_NAMES.map((name) => ({ name }))).map(
    (i) => i.name
  );

  it("removes performance tracing and per-pageview sessions", () => {
    expect(remaining).not.toContain("BrowserTracing");
    expect(remaining).not.toContain("BrowserSession");
  });

  it("keeps every integration that captures errors or gives them context", () => {
    for (const name of [
      "GlobalHandlers",
      "BrowserApiErrors",
      "LinkedErrors",
      "Dedupe",
      "Breadcrumbs",
      "HttpContext",
      "EventFilters",
      "NextjsClientStackFrameNormalization",
    ]) {
      expect(remaining).toContain(name);
    }
    expect(remaining).toHaveLength(DEFAULT_INTEGRATION_NAMES.length - 2);
  });
});
