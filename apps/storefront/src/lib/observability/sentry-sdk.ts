/**
 * The only parts of the Sentry SDK the site uses, for instrumentation-client
 * to load on demand (lib/observability/deferred-sentry.ts).
 *
 * Why a file of its own: `import("@sentry/nextjs")` loads the package's whole
 * namespace — measured at ~150 KB gzipped, because nothing can be tree-shaken
 * from a module object whose every export might be used. Named re-exports
 * from a static import keep the bundler able to drop everything else, so the
 * on-demand chunk is the ~29 KB that used to sit in the framework chunk.
 */
export { init, captureException } from "@sentry/nextjs";
