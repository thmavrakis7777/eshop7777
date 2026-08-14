"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setCustomerActiveAction, withdrawConsentAction } from "@/lib/admin/sales-actions";

/**
 * The narrow set of things an admin may do to a customer record.
 *
 * Notably absent, on purpose:
 *   - No delete. Orders reference the customer, and a real erasure request
 *     needs a decision about that history rather than a cascade.
 *   - No "grant marketing consent". An admin ticking that box on someone
 *     else's behalf is precisely what consent rules exist to prevent, so the
 *     only direction offered is withdrawal.
 *   - No password reset from here. The customer requests it themselves; an
 *     admin-triggered reset is an account-takeover path.
 */
export function CustomerControls({
  customerId,
  isActive,
  hasAccount,
  marketingConsent,
}: {
  customerId: string;
  isActive: boolean;
  hasAccount: boolean;
  marketingConsent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      setMsg(result.ok ? { ok: true, text: result.message ?? "Έγινε." } : { ok: false, text: result.error ?? "" });
      if (result.ok) {
        setConfirmDeactivate(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>
          {msg.text}
        </p>
      )}

      {marketingConsent && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => withdrawConsentAction(customerId))}
          className="rounded-md border border-border px-3 py-2 text-sm text-ink transition-colors hover:bg-surface disabled:opacity-50"
        >
          Απόσυρση συγκατάθεσης marketing
        </button>
      )}

      {hasAccount &&
        (isActive ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmDeactivate(true)}
            className="rounded-md border border-danger/40 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/5 disabled:opacity-50"
          >
            Απενεργοποίηση λογαριασμού
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setCustomerActiveAction(customerId, true))}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:opacity-50"
          >
            Επανενεργοποίηση λογαριασμού
          </button>
        ))}

      {!hasAccount && (
        <p className="text-xs text-ink-muted">
          Ο πελάτης δεν έχει λογαριασμό — έχει παραγγείλει ως επισκέπτης.
        </p>
      )}

      <p className="text-xs text-ink-muted">
        Η διαγραφή πελάτη δεν γίνεται από εδώ: οι παραγγελίες τον αναφέρουν και ένα αίτημα διαγραφής
        δεδομένων χρειάζεται απόφαση για το ιστορικό.
      </p>

      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <button
            type="button"
            aria-label="Άκυρο"
            onClick={() => setConfirmDeactivate(false)}
            className="absolute inset-0 bg-ink/30"
          />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-lg border border-border bg-bg p-6">
            <h2 className="font-display text-lg text-ink">Απενεργοποίηση λογαριασμού</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Ο πελάτης δεν θα μπορεί να συνδεθεί και όλες οι ενεργές συνεδρίες του τερματίζονται
              αμέσως. Οι παραγγελίες του παραμένουν. Μπορείς να το αναιρέσεις ανά πάσα στιγμή.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeactivate(false)}
                className="rounded-md border border-border px-3.5 py-2 text-sm font-medium hover:bg-surface"
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setCustomerActiveAction(customerId, false))}
                className="rounded-md bg-danger px-3.5 py-2 text-sm font-medium text-bg hover:bg-danger/90 disabled:opacity-50"
              >
                Απενεργοποίηση
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
