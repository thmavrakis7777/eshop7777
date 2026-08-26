"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePaymentMethodAction } from "@/lib/admin/settings-actions";
import type { AdminPaymentMethod } from "@/lib/admin/settings";

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

// No "new"/delete here, unlike ShippingManager — shop.payment_method's own
// CHECK constraint fixes the two rows this ever shows (cod, bank_transfer);
// this only edits/toggles them. The card at the bottom is not a row at all —
// a fixed, non-interactive placeholder so it's clear card payment isn't a
// checkbox away from working, per the owner's own instruction that a
// dashboard toggle must never make an unimplemented method appear at
// checkout.
export function PaymentMethodsManager({ methods }: { methods: AdminPaymentMethod[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save(data: FormData) {
    startTransition(async () => {
      const result = await savePaymentMethodAction(data);
      setMsg(result.ok ? { ok: true, text: result.message ?? "Έγινε." } : { ok: false, text: result.error ?? "" });
      if (result.ok) {
        setEditing(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      {msg && (
        <div
          role="status"
          className={`mb-4 rounded-md border px-4 py-2.5 text-sm ${
            msg.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        {methods.map((m) => (
          <div key={m.id} className="border-b border-border last:border-b-0">
            <div className={`flex flex-wrap items-center gap-3 px-4 py-3 ${m.isActive ? "" : "opacity-60"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{m.name}</span>
                  {!m.isActive && (
                    <span className="rounded-sm bg-surface px-1.5 py-0.5 text-xs text-ink-muted">Ανενεργός</span>
                  )}
                </div>
                {m.description && <div className="text-xs text-ink-muted">{m.description}</div>}
              </div>
              <button
                type="button"
                onClick={() => setEditing(editing === m.id ? null : m.id)}
                className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface"
              >
                Επεξεργασία
              </button>
            </div>
            {editing === m.id && (
              <div className="border-t border-border bg-surface/40 px-4 py-4">
                <MethodForm method={m} pending={pending} onCancel={() => setEditing(null)} onSave={save} />
              </div>
            )}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3 px-4 py-3 opacity-60">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink">Πιστωτική / Χρεωστική κάρτα</span>
              <span className="rounded-sm bg-surface px-1.5 py-0.5 text-xs text-ink-muted">Δεν έχει ρυθμιστεί</span>
            </div>
            <div className="text-xs text-ink-muted">
              Χρειάζεται πραγματικό πάροχο πληρωμών (π.χ. Stripe, Viva Wallet) — δεν εμφανίζεται στο checkout μέχρι
              να συνδεθεί ένας.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MethodForm({
  method,
  pending,
  onCancel,
  onSave,
}: {
  method: AdminPaymentMethod;
  pending: boolean;
  onCancel: () => void;
  onSave: (data: FormData) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set("id", method.id);
        onSave(data);
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Όνομα</label>
          <input name="name" defaultValue={method.name} required autoFocus className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Περιγραφή</label>
          <input name="description" defaultValue={method.description ?? ""} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Σειρά</label>
          <input name="sortOrder" defaultValue={method.sortOrder} inputMode="numeric" className={field} />
        </div>
        <div className="flex flex-col justify-end pb-1">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="isActive" defaultChecked={method.isActive} className="h-4 w-4 accent-ink" />
            Ενεργός στο checkout
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Αποθήκευση…" : "Αποθήκευση"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface">
          Άκυρο
        </button>
      </div>
    </form>
  );
}
