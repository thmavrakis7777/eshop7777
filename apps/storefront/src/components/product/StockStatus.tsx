import { ON_ORDER_LABEL, type StockState } from "@/lib/stock";

// Shared by ProductCard and the PDP so "how do we word/color stock state"
// lives in exactly one place — driven by the real stock figures
// (lib/stock.ts stockStateOf), never hardcoded. Three states since the
// owner's «Κατόπιν παραγγελίας» (2026-10-03): orderable now, shipped once
// the supplier delivers — the accent colour, between green and grey.
const STATE: Record<StockState, { label: string; dot: string; text: string }> = {
  in_stock: { label: "Σε απόθεμα", dot: "bg-success", text: "text-success" },
  on_order: { label: ON_ORDER_LABEL, dot: "bg-accent", text: "text-accent" },
  sold_out: { label: "Εξαντλήθηκε", dot: "bg-ink-muted", text: "text-ink-muted" },
};

export function StockStatus({ state, className = "" }: { state: StockState; className?: string }) {
  const s = STATE[state];
  return (
    <p className={`flex items-center gap-1.5 text-xs font-medium ${className}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span className={s.text}>{s.label}</span>
    </p>
  );
}
