"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * The admin's error boundary — the sibling of (storefront)/error.tsx, kept
 * separate rather than shared because the two audiences need opposite things.
 *
 * A customer gets reassurance and a way back to shopping. The shop owner is
 * the person who has to act on the failure, so this one leads with the
 * digest: it is the string that matches the `console.error("[server]
 * UNHANDLED_REQUEST_ERROR", { digest, … })` line instrumentation.ts writes to
 * the Vercel function logs, which is how a report becomes a findable log
 * entry instead of "the dashboard broke at some point yesterday".
 *
 * Placed at app/admin rather than app/admin/(protected) on purpose: this way
 * it also covers the login page, where an error would otherwise lock the
 * owner out of their own dashboard with Next's bare fallback screen.
 *
 * Still shows no error.message: an admin session is authenticated, but this
 * page renders in a browser and the message can carry SQL fragments and
 * connection details that belong only in the server log.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] RENDER_ERROR", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-start justify-center px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">Σφάλμα</p>
      <h1 className="mt-3 font-display text-2xl text-ink md:text-3xl">Κάτι πήγε στραβά</h1>
      <p className="mt-4 text-base leading-relaxed text-ink-muted">
        Η σελίδα διαχείρισης δεν φορτώθηκε. Οι αλλαγές που είχατε ήδη αποθηκεύσει δεν επηρεάζονται.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:bg-ink/90"
        >
          Δοκιμάστε ξανά
        </button>
        <Link
          href="/admin"
          className="rounded-md border border-border px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Πίνακας ελέγχου
        </Link>
      </div>

      {error.digest && (
        <div className="mt-8 w-full rounded-md border border-border bg-surface px-4 py-3">
          <p className="text-xs text-ink-muted">
            Κωδικός σφάλματος — αναφέρετέ τον για να εντοπιστεί στα logs:
          </p>
          <p className="mt-1 font-mono text-sm text-ink">{error.digest}</p>
        </div>
      )}
    </div>
  );
}
