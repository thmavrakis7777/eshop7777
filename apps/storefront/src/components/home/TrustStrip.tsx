// Claims here must match what the store can actually deliver today: the
// delivery window mirrors the real Medusa "Standard Shipping" option, and
// the payment line names the only configured provider (pp_system_default,
// shown at checkout as "Αντικαταβολή"). The earlier "Κάρτα, Viva Wallet ή
// αντικαταβολή" promised two methods checkout can't offer.
const items = [
  {
    title: "Παράδοση σε 2-3 εργάσιμες",
    desc: "Σε όλη την Ελλάδα, με courier συνεργάτη",
    icon: (
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 20a2 2 0 100-4 2 2 0 000 4zM17.5 20a2 2 0 100-4 2 2 0 000 4z" />
    ),
  },
  {
    title: "Δωρεάν επιστροφές 30 ημερών",
    desc: "Αν δεν σου ταιριάζει, το επιστρέφεις εύκολα",
    icon: <path d="M4 4v6h6M4 10a8 8 0 1 1 2.3 5.6" />,
  },
  {
    title: "Πληρωμή με αντικαταβολή",
    desc: "Πληρώνεις όταν παραλάβεις την παραγγελία σου",
    icon: <path d="M3 8h18M3 8v10h18V8M3 8l2-4h14l2 4M7 15h4" />,
  },
  {
    title: "Ελληνική εξυπηρέτηση",
    desc: "Δευ-Παρ 9:00-18:00, στα ελληνικά",
    icon: <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v5l3 3" />,
  },
];

export function TrustStrip() {
  return (
    <section className="container-shell mt-16 md:mt-24">
      <div className="grid grid-cols-2 gap-6 rounded-lg bg-surface p-6 md:grid-cols-4 md:p-10">
        {items.map((item) => (
          <div key={item.title} className="flex flex-col items-start gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-accent" aria-hidden="true">
              {item.icon}
            </svg>
            <span className="text-sm font-medium text-ink">{item.title}</span>
            <span className="text-xs text-ink-muted">{item.desc}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
