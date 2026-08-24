// Same Greek label/tone pairs as components/admin/ui/primitives.tsx's
// STATUS_MAPS, kept as a separate copy rather than a shared import: the
// admin component tree and the storefront component tree are deliberately
// not cross-imported anywhere else in this codebase, and status wording is
// small enough that duplicating the strings is cheaper than adding that
// first cross-tree dependency. If either changes, check the other.
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export const ORDER_STATUS_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Σε αναμονή", tone: "warning" },
  confirmed: { label: "Επιβεβαιωμένη", tone: "info" },
  processing: { label: "Σε επεξεργασία", tone: "info" },
  shipped: { label: "Απεστάλη", tone: "info" },
  delivered: { label: "Παραδόθηκε", tone: "success" },
  cancelled: { label: "Ακυρώθηκε", tone: "danger" },
};

export const PAYMENT_STATUS_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  unpaid: { label: "Απλήρωτη", tone: "warning" },
  paid: { label: "Πληρωμένη", tone: "success" },
  refunded: { label: "Επιστροφή", tone: "neutral" },
  partially_refunded: { label: "Μερική επιστροφή", tone: "neutral" },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = { cod: "Αντικαταβολή" };
export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}
