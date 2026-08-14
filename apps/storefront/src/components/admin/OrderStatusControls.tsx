"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  saveOrderNoteAction,
  setFulfillmentStatusAction,
  setOrderStatusAction,
  setPaymentStatusAction,
} from "@/lib/admin/sales-actions";
import type { FulfillmentStatus, OrderStatus, PaymentStatus } from "@/lib/admin/orders";

/**
 * The three status dimensions an order carries, plus the internal note.
 *
 * They are separate controls because they are genuinely independent: an order
 * can be paid but unfulfilled, or shipped but unpaid (cash on delivery is the
 * default here, so that is the normal case rather than an edge one).
 *
 * Cancelling asks for confirmation because it returns stock, which is a real
 * inventory movement — and it is refused afterwards, since a cancelled order
 * is terminal.
 */

const ORDER_STATUSES: Array<{ value: OrderStatus; label: string }> = [
  { value: "pending", label: "Σε αναμονή" },
  { value: "confirmed", label: "Επιβεβαιωμένη" },
  { value: "processing", label: "Σε επεξεργασία" },
  { value: "shipped", label: "Απεστάλη" },
  { value: "delivered", label: "Παραδόθηκε" },
];

const PAYMENT_STATUSES: Array<{ value: PaymentStatus; label: string }> = [
  { value: "unpaid", label: "Απλήρωτη" },
  { value: "paid", label: "Πληρωμένη" },
  { value: "refunded", label: "Επιστροφή χρημάτων" },
  { value: "partially_refunded", label: "Μερική επιστροφή" },
];

const FULFILLMENT_STATUSES: Array<{ value: FulfillmentStatus; label: string }> = [
  { value: "unfulfilled", label: "Ανεκτέλεστη" },
  { value: "partially_fulfilled", label: "Μερικώς εκτελεσμένη" },
  { value: "fulfilled", label: "Εκτελεσμένη" },
  { value: "returned", label: "Επεστράφη" },
];

const select =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink disabled:opacity-50";

export function OrderStatusControls({
  orderId,
  status,
  paymentStatus,
  fulfillmentStatus,
  adminNote,
  itemCount,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  adminNote: string | null;
  itemCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [note, setNote] = useState(adminNote ?? "");

  const cancelled = status === "cancelled";

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      setMsg(result.ok ? { ok: true, text: result.message ?? "Έγινε." } : { ok: false, text: result.error ?? "" });
      if (result.ok) {
        setConfirmCancel(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>
          {msg.text}
        </p>
      )}

      {cancelled && (
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-muted">
          Η παραγγελία είναι ακυρωμένη. Το απόθεμα έχει επιστραφεί και η κατάσταση δεν αλλάζει άλλο.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="order-status" className="text-sm font-medium text-ink">
          Κατάσταση παραγγελίας
        </label>
        <select
          id="order-status"
          value={cancelled ? "cancelled" : status}
          disabled={cancelled || pending}
          onChange={(e) => run(() => setOrderStatusAction(orderId, e.target.value as OrderStatus))}
          className={select}
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
          {cancelled && <option value="cancelled">Ακυρωμένη</option>}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="payment-status" className="text-sm font-medium text-ink">
          Πληρωμή
        </label>
        <select
          id="payment-status"
          value={paymentStatus}
          disabled={pending}
          onChange={(e) => run(() => setPaymentStatusAction(orderId, e.target.value as PaymentStatus))}
          className={select}
        >
          {PAYMENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fulfillment-status" className="text-sm font-medium text-ink">
          Εκτέλεση
        </label>
        <select
          id="fulfillment-status"
          value={fulfillmentStatus}
          disabled={pending}
          onChange={(e) => run(() => setFulfillmentStatusAction(orderId, e.target.value as FulfillmentStatus))}
          className={select}
        >
          {FULFILLMENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-note" className="text-sm font-medium text-ink">
          Εσωτερική σημείωση
        </label>
        <textarea
          id="admin-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ορατή μόνο στη διαχείριση."
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <button
          type="button"
          disabled={pending || note === (adminNote ?? "")}
          onClick={() => run(() => saveOrderNoteAction(orderId, note))}
          className="self-start rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-40"
        >
          Αποθήκευση σημείωσης
        </button>
      </div>

      {!cancelled && (
        <div className="border-t border-border pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmCancel(true)}
            className="w-full rounded-md border border-danger/40 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/5 disabled:opacity-50"
          >
            Ακύρωση παραγγελίας
          </button>
        </div>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <button
            type="button"
            aria-label="Άκυρο"
            onClick={() => setConfirmCancel(false)}
            className="absolute inset-0 bg-ink/30"
          />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-lg border border-border bg-bg p-6">
            <h2 className="font-display text-lg text-ink">Ακύρωση παραγγελίας</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Θα επιστραφούν <strong className="text-ink">{itemCount} τεμάχια</strong> στο απόθεμα και θα
              καταγραφεί κίνηση αποθέματος. Η ενέργεια δεν αναιρείται — μια ακυρωμένη παραγγελία δεν
              ξανανοίγει.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="rounded-md border border-border px-3.5 py-2 text-sm font-medium hover:bg-surface"
              >
                Πίσω
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setOrderStatusAction(orderId, "cancelled"))}
                className="rounded-md bg-danger px-3.5 py-2 text-sm font-medium text-bg hover:bg-danger/90 disabled:opacity-50"
              >
                {pending ? "Ακύρωση…" : "Ακύρωση παραγγελίας"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
