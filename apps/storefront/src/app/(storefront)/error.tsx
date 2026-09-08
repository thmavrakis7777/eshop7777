"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * The storefront's error boundary — audit finding #5, open across three
 * cycles before this.
 *
 * Without this file an uncaught exception anywhere under (storefront) falls
 * back to Next's built-in error screen: in production an unstyled, unbranded
 * white page reading "Application error: a client-side exception has
 * occurred", with no header, no way back into the shop, and nothing the
 * customer can quote to support. For a shop that is a lost sale and a lost
 * support ticket at the same time.
 *
 * Scoped to the (storefront) group, so it renders INSIDE the shop shell —
 * header, nav and footer survive, and only the failed page content is
 * replaced. That is the whole reason this sits here rather than at app/:
 * a boundary catches errors from its children, never from its own layout, so
 * an error.tsx one level up would take the chrome down with the page.
 *
 * Deliberately a Client Component with no data fetching: it must render when
 * the thing that just failed may well have been a database read.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-rendered errors already reach the logs through
    // instrumentation.ts's onRequestError hook, which records the same
    // `digest`. Errors thrown during client-side rendering never touch the
    // server at all, so this is their only record — same structured shape
    // as every other log line in the codebase, so both are greppable
    // together and correlate on digest.
    console.error("[storefront] RENDER_ERROR", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="container-shell flex min-h-[50vh] max-w-2xl flex-col items-start justify-center py-16">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">Σφάλμα</p>
      <h1 className="mt-3 font-display text-3xl text-ink md:text-4xl">Κάτι πήγε στραβά</h1>
      <p className="mt-4 text-base leading-relaxed text-ink-muted">
        Παρουσιάστηκε ένα απροσδόκητο πρόβλημα κατά τη φόρτωση της σελίδας. Δεν φταίει κάτι που
        κάνατε — δοκιμάστε ξανά σε λίγο.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        {/* reset() re-renders the boundary's children — a real retry of the
            failed segment, not a full page reload, so the cart and the rest
            of the shell are untouched. Recovers on its own if the cause was
            transient (a dropped database connection, a timeout). */}
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:bg-ink/90"
        >
          Δοκιμάστε ξανά
        </button>
        <Link
          href="/"
          className="rounded-md border border-border px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Αρχική σελίδα
        </Link>
      </div>

      <p className="mt-8 text-sm text-ink-muted">
        Αν το πρόβλημα συνεχίζεται,{" "}
        <Link href="/epikoinonia" className="text-ink underline underline-offset-2 hover:text-accent">
          επικοινωνήστε μαζί μας
        </Link>
        .
      </p>

      {/* The digest, and only the digest. Next generates it server-side, logs
          it, and sends just this hash to the browser precisely so the message
          and stack — which can carry query fragments, table names or
          connection details — never reach the customer. Showing it lets
          someone quote one short string that matches a real log line. */}
      {error.digest && (
        <p className="mt-2 text-xs text-ink-muted">
          Κωδικός σφάλματος: <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </div>
  );
}
