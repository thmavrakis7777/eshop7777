import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribeByToken } from "@/lib/db/newsletter";

export const metadata: Metadata = {
  title: "Απεγγραφή από το newsletter",
  robots: { index: false, follow: true },
  alternates: { canonical: "/newsletter/apengrafi" },
};

// One click, no login: the token in the query string is the entire auth
// model (192 bits, unique per subscriber, never shown anywhere but their
// own confirmation email) — the same trust model this app already uses for
// a guest order's confirmation-page link. Landing here IS the unsubscribe
// action; idempotent by construction (unsubscribeByToken on an already-
// inactive row just reports success again), so a second visit, a retry,
// or a mail client re-fetching the link never errors or double-processes.
export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await unsubscribeByToken(token) : "invalid";

  return (
    <div className="container-shell flex flex-col items-center gap-4 py-16 text-center md:py-24">
      {result === "unsubscribed" || result === "already_unsubscribed" ? (
        <>
          <h1 className="font-display text-2xl text-ink md:text-3xl">Η απεγγραφή ολοκληρώθηκε.</h1>
          <p className="max-w-md text-sm text-ink-muted">
            Δεν θα λαμβάνεις πλέον emails newsletter από το MAVRAKIS HOME. Οι παραγγελίες σου δεν
            επηρεάζονται — θα συνεχίσεις να λαμβάνεις email σχετικά με αυτές κανονικά.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl text-ink md:text-3xl">Ο σύνδεσμος δεν είναι έγκυρος.</h1>
          <p className="max-w-md text-sm text-ink-muted">
            Ελέγξτε ότι ανοίξατε τον σύνδεσμο ολόκληρο από το email, ή επικοινωνήστε μαζί μας αν
            χρειάζεσαι βοήθεια με την εγγραφή σου.
          </p>
        </>
      )}
      <Link href="/" className="mt-2 rounded-sm bg-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent">
        Επιστροφή στην αρχική
      </Link>
    </div>
  );
}
