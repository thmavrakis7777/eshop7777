import type { HomepageSection, TrustIconName, TrustItem } from "@/lib/content-types";

/**
 * The guarantee icons, as inline SVG paths keyed by a fixed name.
 *
 * A closed set on purpose: these are rendered inside a <svg> we control, so
 * accepting owner-supplied markup would be a script-injection hole, and
 * arbitrary uploaded images would break the strip's alignment. The owner
 * picks from this list; the wording beside it is entirely theirs.
 */
const ICON_PATHS: Record<TrustIconName, React.ReactNode> = {
  truck: (
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 20a2 2 0 100-4 2 2 0 000 4zM17.5 20a2 2 0 100-4 2 2 0 000 4z" />
  ),
  returns: <path d="M4 4v6h6M4 10a8 8 0 1 1 2.3 5.6" />,
  payment: <path d="M3 8h18M3 8v10h18V8M3 8l2-4h14l2 4M7 15h4" />,
  support: <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v5l3 3" />,
  shield: <path d="M12 3l7 3v6c0 4.2-2.9 7.9-7 9-4.1-1.1-7-4.8-7-9V6z" />,
  phone: (
    <path d="M6.6 3h2.2l1.4 3.5-1.8 1.2a10.5 10.5 0 0 0 4.9 4.9l1.2-1.8L18 12.2v2.2a2 2 0 0 1-2.2 2A13.8 13.8 0 0 1 4.6 5.2 2 2 0 0 1 6.6 3z" />
  ),
  gift: <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7S10.5 3 8.5 3a2 2 0 100 4M12 7s1.5-4 3.5-4a2 2 0 110 4" />,
  leaf: <path d="M5 19c0-8 5-13 14-13 0 9-5 13-11 13H5zM5 19c1.5-3 3.5-5 6-6.5" />,
};

export const TRUST_ICON_NAMES = Object.keys(ICON_PATHS) as TrustIconName[];

/**
 * Shipped defaults, used until the owner edits the section.
 *
 * These claims must match what the store can actually deliver: the delivery
 * window mirrors the real "Standard Shipping" option and the payment line
 * names the only configured provider (cash on delivery). An earlier version
 * promised "Κάρτα, Viva Wallet ή αντικαταβολή" — two methods checkout could
 * not offer. Now that the text is editable, that risk moves to the owner,
 * which is why the admin form says so explicitly.
 */
export const DEFAULT_TRUST_ITEMS: TrustItem[] = [
  {
    icon: "truck",
    title: "Παράδοση σε 2-3 εργάσιμες",
    description: "Σε όλη την Ελλάδα, με courier συνεργάτη",
    visible: true,
  },
  {
    icon: "returns",
    title: "Δωρεάν επιστροφές 30 ημερών",
    description: "Αν δεν σου ταιριάζει, το επιστρέφεις εύκολα",
    visible: true,
  },
  {
    icon: "payment",
    title: "Πληρωμή με αντικαταβολή",
    description: "Πληρώνεις όταν παραλάβεις την παραγγελία σου",
    visible: true,
  },
  {
    icon: "support",
    title: "Ελληνική εξυπηρέτηση",
    description: "Δευ-Παρ 9:00-18:00, στα ελληνικά",
    visible: true,
  },
];

/** Owner-configured items when present, otherwise the shipped defaults. */
export function resolveTrustItems(section?: HomepageSection): TrustItem[] {
  const configured = section?.config.items;
  const items = configured && configured.length > 0 ? configured : DEFAULT_TRUST_ITEMS;
  return items.filter((i) => i.visible && i.title.trim());
}

// Static class strings, not interpolated â Tailwind only emits classes it can
// see literally in the source, so `md:grid-cols-${n}` would compile to nothing.
const MD_COLS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

export function TrustStrip({ section }: { section?: HomepageSection } = {}) {
  const items = resolveTrustItems(section);
  if (items.length === 0) return null;

  const heading = section?.heading?.trim();

  // Not container-shell on the section itself — same reasoning as Hero/
  // EditorialBanner/Newsletter: nothing between here and <body> constrains
  // width, so the bg-surface band below can run edge to edge just by not
  // opting into the constraint. Unlike those three, the actual badge row
  // stays at the site's normal container-shell width (reused, not a new
  // max-width value) so four badges don't end up scattered across an
  // enormous 1920px+ screen — the colored band now only carries vertical
  // padding (py-6/py-10); horizontal inset comes from container-shell,
  // matching every other section's side margin exactly instead of stacking
  // two different paddings.
  return (
    <section className="mt-16 md:mt-24">
      {heading && (
        <h2 className="container-shell mb-4 font-display text-xl text-ink md:text-2xl">{heading}</h2>
      )}
      <div className="bg-surface py-6 md:py-10">
        <div className={`container-shell grid grid-cols-2 gap-6 ${MD_COLS[Math.min(items.length, 4)]}`}>
          {items.map((item, i) => (
            <div key={`${item.title}-${i}`} className="flex flex-col items-start gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-accent"
                aria-hidden="true"
              >
                {ICON_PATHS[item.icon] ?? ICON_PATHS.truck}
              </svg>
              <span className="text-sm font-medium text-ink">{item.title}</span>
              {item.description && (
                <span className="text-xs text-ink-muted">{item.description}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
