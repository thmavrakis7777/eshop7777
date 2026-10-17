/**
 * «Συνήθως αγοράζεται μαζί» — the owner's own pairings, from what customers
 * in the shop actually buy together (not computed from orders). Keyed by the
 * product's own category slug (the leaf category it sits in), valued by the
 * companions' product codes in display order, so every product of that
 * category — including ones added later — shows the same companions under
 * its add-to-cart button (BoughtTogether.tsx).
 *
 * Code-level on purpose while there are only a few pairings; if the owner
 * wants to manage these themselves, this moves to the dashboard.
 */
const COMPANIONS_BY_CATEGORY: Record<string, string[]> = {
  // Κουζινάκια Πετρογκάζ Οικιακά → Σετ ρυθμιστής χαμηλής πίεσης 30mbar με
  // λάστιχο 1,5m: a household stove needs a regulator and hose to connect.
  "oikiaka-kouzinakia-petrogkaz": ["00047"],
  // High-pressure stoves and professional burners → the two high-pressure
  // regulator sets with hose, (Β) 0-3bar and (Α) 0.5-4bar.
  "kouzinakia-ypsilis-piesis": ["00048", "00049"],
  "epaggelmatika-flogistra": ["00048", "00049"],
};

export function companionCodesFor(categoryHandle: string | undefined): string[] {
  return (categoryHandle && COMPANIONS_BY_CATEGORY[categoryHandle]) || [];
}
