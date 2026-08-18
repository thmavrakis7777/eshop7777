import Link from "next/link";

/**
 * SALES and NEW ARRIVALS, shown beside the real categories.
 *
 * They are deliberately NOT rows in the category table. Membership is derived
 * from data the operator already maintains — a variant's compare-at price,
 * and a product's creation date — so there is no list to keep in sync and no
 * way for the dashboard to disagree with the shop. Adding them as real
 * categories would mean manually adding and removing products, which is the
 * exact chore this avoids.
 *
 * That is also why these cards have no Edit, Delete or "add product" control:
 * every one of them would be a lie. What they DO offer is the thing an
 * operator actually wants — see what is currently in there, and click through
 * to the normal product screen to change it.
 */

const DYNAMIC = [
  {
    key: "sale" as const,
    title: "ΠΡΟΣΦΟΡΕΣ",
    rule: "Αυτόματο • Με βάση την τιμή προσφοράς",
    detail:
      "Μπαίνει αυτόματα κάθε προϊόν με τιμή προσφοράς χαμηλότερη από την κανονική. Βγαίνει μόλις αφαιρεθεί η προσφορά.",
    storefront: "/prosfores",
  },
  {
    key: "new" as const,
    title: "ΝΕΕΣ ΑΦΙΞΕΙΣ",
    rule: "Αυτόματο • Με βάση την ημερομηνία δημιουργίας",
    detail:
      "Μπαίνει αυτόματα κάθε νέο προϊόν των τελευταίων 30 ημερών, με τα νεότερα πρώτα. Μπορείς να κρατήσεις ένα προϊόν εδώ για περισσότερο με τη σήμανση «Νέο» στη σελίδα του.",
    storefront: "/nea-afiksi",
  },
];

export function DynamicCollections({
  counts,
}: {
  counts: { sale: number; newArrivals: number };
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink">
        Αυτόματες κατηγορίες
      </h2>
      <p className="mb-3 text-xs text-ink-muted">
        Δεν χρειάζονται συντήρηση — τα προϊόντα μπαίνουν και βγαίνουν μόνα τους.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {DYNAMIC.map((d) => {
          const count = d.key === "sale" ? counts.sale : counts.newArrivals;
          return (
            <div key={d.key} className="rounded-lg border border-border p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">{d.title}</h3>
                <span className="shrink-0 text-sm tabular-nums text-ink-muted">
                  {count} {count === 1 ? "προϊόν" : "προϊόντα"}
                </span>
              </div>

              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-accent">
                {d.rule}
              </p>
              <p className="mt-2 text-xs text-ink-muted">{d.detail}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/admin/products?dynamic=${d.key}`}
                  className="rounded-sm border border-border px-3 py-1.5 text-sm text-ink transition-colors hover:border-ink"
                >
                  Δες τα προϊόντα
                </Link>
                <Link
                  href={d.storefront}
                  target="_blank"
                  className="rounded-sm px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
                >
                  Προβολή στο κατάστημα →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
