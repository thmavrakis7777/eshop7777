import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type StatusTone } from "@/lib/order-status-labels";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-surface text-ink-muted",
  info: "bg-surface-strong text-ink",
  success: "bg-success/10 text-success",
  warning: "bg-accent/10 text-accent",
  danger: "bg-danger/10 text-danger",
};

export function OrderStatusBadge({ status, kind = "order" }: { status: string; kind?: "order" | "payment" }) {
  const map = kind === "order" ? ORDER_STATUS_LABELS : PAYMENT_STATUS_LABELS;
  const entry = map[status] ?? { label: status, tone: "neutral" as StatusTone };
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[entry.tone]}`}>
      {entry.label}
    </span>
  );
}
