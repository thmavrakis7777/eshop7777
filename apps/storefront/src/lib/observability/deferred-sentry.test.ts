import { describe, it, expect, vi, beforeEach } from "vitest";
import { startSentryAfterLoad } from "@/lib/observability/deferred-sentry";
import { captureBoundaryError } from "@/lib/observability/capture-boundary-error";

/**
 * Loading Sentry late is only acceptable if nothing from before it arrives
 * goes missing. These pin that: the SDK waits for `load`, and every error
 * from the wait — uncaught, unhandled rejection or caught by an error
 * boundary — is reported once it is ready.
 */

const REPORTER_KEY = "__mavrakisHomeBoundaryErrorReporter";

function fakeWindow(readyState: DocumentReadyState = "loading") {
  const target = new EventTarget();
  return {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    setTimeout: ((fn: () => void) => {
      fn();
      return 0;
    }) as unknown as Window["setTimeout"],
    document: { readyState },
  };
}

function errorEvent(error: unknown) {
  const event = new Event("error") as Event & { error: unknown };
  event.error = error;
  return event;
}

function rejectionEvent(reason: unknown) {
  const event = new Event("unhandledrejection") as Event & { reason: unknown };
  event.reason = reason;
  return event;
}

function fakeSdk() {
  return { init: vi.fn(), captureException: vi.fn() };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  delete (globalThis as Record<string, unknown>)[REPORTER_KEY];
});

describe("startSentryAfterLoad", () => {
  it("doesn't load the SDK until the page has loaded", async () => {
    const win = fakeWindow();
    const load = vi.fn(async () => fakeSdk());
    startSentryAfterLoad({ dsn: "x" }, load, win as never);
    await flush();
    expect(load).not.toHaveBeenCalled();

    win.dispatchEvent(new Event("load"));
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("starts at once on a page that has already loaded", async () => {
    const sdk = fakeSdk();
    startSentryAfterLoad({ dsn: "x" }, async () => sdk, fakeWindow("complete") as never);
    await flush();
    expect(sdk.init).toHaveBeenCalledWith({ dsn: "x" });
  });

  it("reports every error from before the SDK arrived, marked as unhandled", async () => {
    const win = fakeWindow();
    const sdk = fakeSdk();
    startSentryAfterLoad({ dsn: "x" }, async () => sdk, win as never);

    const uncaught = new Error("thrown in a click handler");
    const rejected = new Error("fetch failed");
    const boundary = new Error("render failed");
    win.dispatchEvent(errorEvent(uncaught));
    win.dispatchEvent(rejectionEvent(rejected));
    captureBoundaryError(boundary, "storefront");
    // Cross-origin "Script error." carries no Error — not worth a report.
    win.dispatchEvent(errorEvent(null));

    win.dispatchEvent(new Event("load"));
    await flush();

    expect(sdk.captureException).toHaveBeenCalledTimes(3);
    expect(sdk.captureException).toHaveBeenCalledWith(uncaught, { mechanism: { type: "onerror", handled: false } });
    expect(sdk.captureException).toHaveBeenCalledWith(rejected, {
      mechanism: { type: "onunhandledrejection", handled: false },
    });
    expect(sdk.captureException).toHaveBeenCalledWith(boundary, { tags: { error_boundary: "storefront" } });
  });

  it("hands over to the SDK once it is running", async () => {
    const win = fakeWindow("complete");
    const sdk = fakeSdk();
    startSentryAfterLoad({ dsn: "x" }, async () => sdk, win as never);
    await flush();

    // Uncaught errors are now Sentry's own GlobalHandlers' job — the queue's
    // listener is gone, so nothing is reported twice.
    win.dispatchEvent(errorEvent(new Error("later")));
    expect(sdk.captureException).not.toHaveBeenCalled();

    // Boundary errors go straight to the SDK.
    const later = new Error("later render error");
    captureBoundaryError(later, "admin");
    expect(sdk.captureException).toHaveBeenCalledWith(later, { tags: { error_boundary: "admin" } });
  });

  it("never throws when the SDK can't be loaded (offline, blocked)", async () => {
    const win = fakeWindow("complete");
    expect(() => startSentryAfterLoad({ dsn: "x" }, () => Promise.reject(new Error("blocked")), win as never)).not.toThrow();
    await flush();
  });
});
