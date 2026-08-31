"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteOrderPermanentlyAction } from "@/lib/admin/sales-actions";

/**
 * Deliberately separate from OrderStatusControls's "Ακύρωση παραγγελίας" —
 * cancelling keeps the order as history and can be done from any non-
 * terminal status; this removes the record entirely and is available
 * independently of it, not gated behind cancelling first. The confirmation
 * modal mirrors OrderStatusControls's cancel-confirmation exactly (same
 * dialog shape, same danger-button styling) since it's the same category of
 * decision, just more severe.
 */
export function DeleteOrderControls({ orderId, orderNumber }: { orderId: string; orderNumber: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    // useTransition's own `pending` flag (via the disabled buttons below) is
    // what actually prevents a duplicate request if this fires twice before
    // the first completes — the guard is structural, not a manual flag.
    setError(null);
    startTransition(async () => {
      const result = await deleteOrderPermanentlyAction(orderId);
      if (result.ok) {
        // The order is gone — nothing left on this page to refresh. The
        // list page reads ?deleted= to show the success confirmation, since
        // there's no toast system in this codebase to reuse instead.
        router.push(`/admin/orders?deleted=${orderNumber}`);
      } else {
        setConfirmDelete(false);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-xs text-ink-muted">
        Αφαιρεί την παραγγελία οριστικά. Δεν μπορεί να αναιρεθεί — αν θέλεις να κρατήσεις την παραγγελία ως
        ιστορικό, χρησιμοποίησε την Ακύρωση αντί αυτού.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirmDelete(true)}
        className="w-full rounded-md border border-danger/40 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/5 disabled:opacity-50"
      >
        Οριστική διαγραφή παραγγελίας
      </button>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <button
            type="button"
            aria-label="Άκυρο"
            onClick={() => !pending && setConfirmDelete(false)}
            className="absolute inset-0 bg-ink/30"
          />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-lg border border-border bg-bg p-6">
            <h2 className="font-display text-lg text-ink">Οριστική διαγραφή παραγγελίας;</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Είστε σίγουροι ότι θέλετε να διαγράψετε οριστικά την παραγγελία{" "}
              <strong className="text-ink">#{orderNumber}</strong>; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-border px-3.5 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
              >
                Ακύρωση
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
                className="rounded-md bg-danger px-3.5 py-2 text-sm font-medium text-bg hover:bg-danger/90 disabled:opacity-50"
              >
                {pending ? "Διαγραφή…" : "Οριστική διαγραφή"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
