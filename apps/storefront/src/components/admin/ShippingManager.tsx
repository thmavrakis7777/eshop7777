"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteShippingMethodAction, saveShippingMethodAction } from "@/lib/admin/settings-actions";
import type { AdminShippingMethod } from "@/lib/admin/settings";

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

const money = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" });
const euros = (cents: number | null) => (cents == null ? "" : (cents / 100).toFixed(2).replace(".", ","));

export function ShippingManager({ methods }: { methods: AdminShippingMethod[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
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

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-bg hover:bg-ink/90"
        >
          Νέα μέθοδος
        </button>
      </div>

      {editing === "new" && (
        <div className="mb-4">
          <MethodForm pending={pending} onCancel={() => setEditing(null)} onSave={(d) => run(() => saveShippingMethodAction(d))} />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        {methods.map((m) => (
          <div key={m.id} className="border-b border-border last:border-b-0">
            <div className={`flex flex-wrap items-center gap-3 px-4 py-3 ${m.isActive ? "" : "opacity-60"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{m.name}</span>
                  {m.isPickup && (
                    <span className="rounded-sm bg-surface-strong px-1.5 py-0.5 text-xs text-ink">Παραλαβή</span>
                  )}
                  {!m.isActive && (
                    <span className="rounded-sm bg-surface px-1.5 py-0.5 text-xs text-ink-muted">Ανενεργή</span>
                  )}
                </div>
                {m.description && <div className="text-xs text-ink-muted">{m.description}</div>}
              </div>
              <div className="text-sm tabular-nums text-ink">
                {m.priceCents === 0 ? "Δωρεάν" : money.format(m.priceCents / 100)}
              </div>
              {m.freeOverCents != null && (
                <div className="text-xs text-ink-muted">δωρεάν άνω των {money.format(m.freeOverCents / 100)}</div>
              )}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(m.id)}
                  className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface"
                >
                  Επεξεργασία
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => deleteShippingMethodAction(m.id))}
                  className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-danger/5 hover:text-danger"
                >
                  Διαγραφή
                </button>
              </div>
            </div>
            {editing === m.id && (
              <div className="border-t border-border bg-surface/40 px-4 py-4">
                <MethodForm
                  method={m}
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSave={(d) => run(() => saveShippingMethodAction(d))}
                />
              </div>
            )}
          </div>
        ))}
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
  method?: AdminShippingMethod;
  pending: boolean;
  onCancel: () => void;
  onSave: (data: FormData) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        if (method) data.set("id", method.id);
        onSave(data);
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Όνομα</label>
          <input name="name" defaultValue={method?.name ?? ""} required autoFocus className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Περιγραφή</label>
          <input name="description" defaultValue={method?.description ?? ""} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Κόστος (€)</label>
          <input name="price" defaultValue={euros(method?.priceCents ?? 0)} inputMode="decimal" className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Δωρεάν άνω των (€)</label>
          <input
            name="freeOver"
            defaultValue={euros(method?.freeOverCents ?? null)}
            inputMode="decimal"
            placeholder="Ποτέ δωρεάν"
            className={field}
          />
          <p className="text-xs text-ink-muted">Κενό αν δεν υπάρχει όριο δωρεάν αποστολής.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Σειρά</label>
          <input name="sortOrder" defaultValue={method?.sortOrder ?? 0} inputMode="numeric" className={field} />
        </div>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="isPickup" defaultChecked={method?.isPickup ?? false} className="h-4 w-4 accent-ink" />
            Παραλαβή από το κατάστημα
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="isActive" defaultChecked={method?.isActive ?? true} className="h-4 w-4 accent-ink" />
            Ενεργή
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
