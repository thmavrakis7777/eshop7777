/**
 * The address bar's query string, read at the moment it's needed — for the
 * category sort and filter controls, which only need it inside a click
 * handler to build the next URL.
 *
 * Instead of next/navigation's useSearchParams() hook: on a cached (static)
 * page that hook makes Next skip server rendering up to the nearest
 * Suspense boundary (BAILOUT_TO_CLIENT_SIDE_RENDERING). The category pages'
 * nearest boundary is their loading skeleton, so the cached HTML held a
 * skeleton and no products until JavaScript ran — measured on a production
 * build, 2026-10-19 (PAGE_CACHING_SPEC.md). Reading location.search inside
 * the handler gives the same value with no render-time dependency.
 *
 * Browser only: call it from event handlers, never during render.
 */
export function currentQuery(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}
