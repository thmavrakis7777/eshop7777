// Single source of truth for the desktop table's column widths — shared by
// CartTableHeader and CartLineItemTableRow so the header and every row are
// guaranteed to line up (a hand-duplicated class string on each would drift).
//
// ΠΡΟΪΟΝ was originally `minmax(0,1fr)` — an unbounded floor. Inside this
// page's two-column layout (items + a 380px summary sidebar), the four
// fixed price/quantity columns plus their gaps already consume most of the
// available width at common laptop sizes, so `1fr` had nothing left to
// distribute and collapsed to a few px. Since the product image is
// `shrink-0`, it (and the title) overflowed that near-zero column and
// visually spilled onto ΑΡΧΙΚΗ ΤΙΜΗ next to it — a real bug, not a display
// artifact. `minmax(14rem,1fr)` gives ΠΡΟΪΟΝ a guaranteed usable floor;
// on the rare narrower viewport where even that doesn't fit, every grid
// instance (the header and each row) independently floors out to the exact
// same total width — deterministic, since none of them are intrinsically
// (min-/max-content) sized — so they overflow their shared
// overflow-x-auto wrapper in CartPageView by the same amount and scroll in
// lockstep. Do NOT add `min-w-max`/`w-max` to the header, the row, or their
// wrapper to "guarantee" that overflow: it forces max-content sizing, which
// measures each grid instance's ΠΡΟΪΟΝ column against *its own* content
// (the header's short label vs. a row's actual product title) instead of
// against the shared container width — the two then compute different
// pixel widths and the columns visibly desync. Found and reverted during
// the Phase 4A.1 layout-bug fix; don't reintroduce it.
export const CART_TABLE_GRID_COLS = "grid-cols-[minmax(14rem,1fr)_7rem_7rem_9.5rem_7rem]";
