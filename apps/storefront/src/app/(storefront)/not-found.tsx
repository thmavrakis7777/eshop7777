import Link from "next/link";

/**
 * The storefront's 404, rendered inside the shop shell (header, nav, footer)
 * rather than as Next's bare default page.
 *
 * Why this file exists at all: `notFound()` previously resolved against the
 * global `/_not-found`, which renders outside `(storefront)/layout.tsx` — an
 * unbranded white page with no way back into the shop. A 404 is a normal,
 * frequent destination (a retired category URL, a mistyped handle, a stale
 * inbound link), and Google's own guidance is that it should help the visitor
 * continue rather than dead-end them.
 *
 * Deliberately static: no database call. This page has to be the one thing
 * that still renders when a lookup has already failed, and it is reached by
 * bots crawling junk URLs, so it should cost nothing to serve.
 */
export default function StorefrontNotFound() {
  return (
    <div className="container-shell flex min-h-[50vh] max-w-2xl flex-col items-start justify-center py-16">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">404</p>
      <h1 className="mt-3 font-display text-3xl text-ink md:text-4xl">Η σελίδα δεν βρέθηκε</h1>
      <p className="mt-4 text-base leading-relaxed text-ink-muted">
        Η σελίδα που ζητήσατε δεν υπάρχει ή έχει μετακινηθεί. Μπορεί ο σύνδεσμος να είναι παλιός ή η
        διεύθυνση να έχει γραφτεί λάθος.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:bg-ink/90"
        >
          Αρχική σελίδα
        </Link>
        <Link
          href="/anazitisi"
          className="rounded-md border border-border px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Αναζήτηση προϊόντων
        </Link>
      </div>

      <p className="mt-8 text-sm text-ink-muted">
        Ή δείτε τις{" "}
        <Link href="/nea-afiksi" className="text-ink underline underline-offset-2 hover:text-accent">
          νέες αφίξεις
        </Link>{" "}
        και τις{" "}
        <Link href="/prosfores" className="text-ink underline underline-offset-2 hover:text-accent">
          προσφορές
        </Link>
        , ή{" "}
        <Link href="/epikoinonia" className="text-ink underline underline-offset-2 hover:text-accent">
          επικοινωνήστε μαζί μας
        </Link>
        .
      </p>
    </div>
  );
}
