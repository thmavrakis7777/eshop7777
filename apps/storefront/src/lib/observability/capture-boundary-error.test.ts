import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  captureBoundaryError,
  registerBoundaryErrorReporter,
  sentryBoundaryReporter,
} from "@/lib/observability/capture-boundary-error";

/**
 * The digest rule is the part worth pinning down. Get it backwards and either
 * every server failure lands in Sentry a second time as a stackless
 * placeholder, or the browser-side render errors — the whole reason this
 * integration exists — are silently dropped.
 */

const REPORTER_KEY = "__mavrakisHomeBoundaryErrorReporter";

beforeEach(() => {
  delete (globalThis as Record<string, unknown>)[REPORTER_KEY];
});

describe("captureBoundaryError", () => {
  it("is a silent no-op before Sentry has registered a reporter (no DSN configured)", () => {
    expect(() => captureBoundaryError(new Error("x"), "storefront")).not.toThrow();
  });

  it("reports an error thrown in the browser through the registered reporter", () => {
    const reporter = vi.fn();
    registerBoundaryErrorReporter(reporter);

    const error = new Error("Cannot read properties of undefined (reading 'price')");
    captureBoundaryError(error, "storefront");

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(error, "storefront");
  });

  it("skips server-originated errors, which carry a digest and are tracked server-side", () => {
    const reporter = vi.fn();
    registerBoundaryErrorReporter(reporter);

    const serverError = Object.assign(new Error("An error occurred in the Server Components render."), {
      digest: "609931948",
    });
    captureBoundaryError(serverError, "storefront");

    expect(reporter).not.toHaveBeenCalled();
  });

  it("never throws inside an error boundary, even if the reporter itself fails", () => {
    registerBoundaryErrorReporter(() => {
      throw new Error("SDK failure");
    });

    expect(() => captureBoundaryError(new Error("x"), "root")).not.toThrow();
  });
});

describe("sentryBoundaryReporter", () => {
  it("sends the error to Sentry tagged with the boundary that caught it", () => {
    const captureException = vi.fn();
    const report = sentryBoundaryReporter(captureException);

    const error = new Error("render failure");
    report(error, "admin");
    report(error, "root");

    expect(captureException).toHaveBeenNthCalledWith(1, error, { tags: { error_boundary: "admin" } });
    expect(captureException).toHaveBeenNthCalledWith(2, error, { tags: { error_boundary: "root" } });
  });
});
