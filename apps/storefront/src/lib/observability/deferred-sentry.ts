import {
  registerBoundaryErrorReporter,
  sentryBoundaryReporter,
  type ErrorBoundaryName,
} from "@/lib/observability/capture-boundary-error";

/**
 * Loads the Sentry SDK only after the page has finished loading, without
 * losing the errors that happen before it arrives.
 *
 * Why: the SDK is ~29 KB gzipped of JavaScript (measured in production's
 * framework chunk, 07 Οκτ 2026) plus its own start-up work, and loaded the
 * old way — imported at the top of instrumentation-client.ts — it downloaded
 * and ran before the page could paint. PageSpeed's phone test counts every
 * byte that arrives before the main photo appears, so the error tracker was
 * slowing the very first impression it exists to protect.
 *
 * What replaces the "initialised before hydration" guarantee: two plain
 * listeners and a queue, registered immediately and costing nothing. Any
 * uncaught error, unhandled rejection or error-boundary report from the
 * first seconds is held, then sent the moment the SDK is ready — so those
 * errors are reported a little later, not missed. What they do lose is the
 * breadcrumb trail from before the SDK started (it wasn't recording yet);
 * and an error followed by the visitor leaving within those seconds is lost
 * with the page — the trade the owner accepted for a faster first screen.
 *
 * Cross-origin "Script error." events (no Error object, no stack) are not
 * queued: Sentry drops them by default, and allowUrls would anyway.
 */

type SentrySdk = {
  init(options: never): unknown;
  captureException(exception: unknown, hint?: never): unknown;
};

type Queued =
  | { kind: "uncaught"; error: Error; mechanism: "onerror" | "onunhandledrejection" }
  | { kind: "boundary"; error: Error; boundary: ErrorBoundaryName };

type Host = Pick<Window, "addEventListener" | "removeEventListener" | "setTimeout"> & {
  document: Pick<Document, "readyState">;
  requestIdleCallback?: Window["requestIdleCallback"];
};

export function startSentryAfterLoad<Options>(
  options: Options,
  loadSdk: () => Promise<{ init(options: Options): unknown; captureException: SentrySdk["captureException"] }>,
  host: Host = window
): void {
  const queue: Queued[] = [];
  const onError = (event: ErrorEvent) => {
    if (event.error instanceof Error) queue.push({ kind: "uncaught", error: event.error, mechanism: "onerror" });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (event.reason instanceof Error) {
      queue.push({ kind: "uncaught", error: event.reason, mechanism: "onunhandledrejection" });
    }
  };
  host.addEventListener("error", onError);
  host.addEventListener("unhandledrejection", onRejection);
  // Error boundaries report through this (capture-boundary-error.ts) — queue
  // until the real reporter replaces it below.
  registerBoundaryErrorReporter((error, boundary) => queue.push({ kind: "boundary", error, boundary }));

  const start = () => {
    loadSdk()
      .then((Sentry) => {
        Sentry.init(options);
        // From here Sentry's own GlobalHandlers catch uncaught errors.
        host.removeEventListener("error", onError);
        host.removeEventListener("unhandledrejection", onRejection);
        const report = sentryBoundaryReporter(Sentry.captureException as never);
        registerBoundaryErrorReporter(report);
        for (const item of queue.splice(0)) {
          if (item.kind === "boundary") report(item.error, item.boundary);
          // Marked unhandled, the way GlobalHandlers would have marked them.
          else Sentry.captureException(item.error, { mechanism: { type: item.mechanism, handled: false } } as never);
        }
      })
      // Offline, or blocked by a content blocker: monitoring must never be
      // the reason a page throws.
      .catch(() => {});
  };

  // After `load` (the first screen is done) and then when the browser is
  // idle, so the SDK never competes with anything the visitor is waiting for.
  const whenIdle = () => {
    if (host.requestIdleCallback) host.requestIdleCallback(start, { timeout: 3000 });
    else host.setTimeout(start, 1);
  };
  if (host.document.readyState === "complete") whenIdle();
  else host.addEventListener("load", whenIdle, { once: true });
}
