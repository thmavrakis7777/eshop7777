import { CART_TABLE_GRID_COLS } from "@/components/cart/cart-table-grid";

// Desktop-only (rendered at lg+ by CartPageView) — the literal uppercase
// Greek strings are hardcoded rather than produced via CSS `uppercase` on
// lowercase text: browser-generated Greek caps keep the acute accent
// (ΠΡΟΪΌΝ), while the conventional/requested form drops it (ΠΡΟΪΟΝ).
export function CartTableHeader() {
  return (
    <div
      className={`hidden lg:grid ${CART_TABLE_GRID_COLS} items-center gap-4 border-b border-border pb-3 text-xs font-medium tracking-wide text-ink-muted`}
    >
      <span>ΠΡΟΪΟΝ</span>
      <span className="text-right">ΑΡΧΙΚΗ ΤΙΜΗ</span>
      <span className="text-right">ΤΙΜΗ</span>
      <span className="text-center">ΠΟΣΟΤΗΤΑ</span>
      <span className="text-right">ΣΥΝΟΛΟ</span>
    </div>
  );
}
