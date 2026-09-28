"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteDiscountAction, getDiscountUsageAction, saveDiscountAction } from "@/lib/admin/sales-actions";
import type { AdminDiscount, DiscountUsage } from "@/lib/admin/discounts";
import { money, centsToPriceInput } from "@/components/admin/ui/primitives";
import { SHOP_TIME_ZONE } from "@/lib/dates";

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

// Pinned to the shop's timezone: this renders on the server (UTC) first, and
// an end date just after midnight in Greece would otherwise show the day
// before — and differ between server and browser.
const date = new Intl.DateTimeFormat("el-GR", { dateStyle: "medium", timeZone: SHOP_TIME_ZONE });

// State is derived from the dates and counters, never stored — so the badge
// can never disagree with what checkout will actually do.
const STATE: Record<AdminDiscount["state"], { label: string; cls: string }> = {
  active: { label: "Ενεργός", cls: "bg-success/10 text-success" },
  scheduled: { label: "Προγραμματισμένος", cls: "bg-surface-strong text-ink" },
  expired: { label: "Έληξε", cls: "bg-surface text-ink-muted" },
  exhausted: { label: "Εξαντλήθηκε", cls: "bg-surface text-ink-muted" },
  disabled: { label: "Ανενεργός", cls: "bg-surface text-ink-muted" },
};

const forInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function DiscountManager({ discounts }: { discounts: AdminDiscount[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminDiscount | null>(null);
  const [usageOf, setUsageOf] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      setMsg(result.ok ? { ok: true, text: result.message ?? "Έγινε." } : { ok: false, text: result.error ?? "" });
      if (result.ok) {
        setEditing(null);
        setConfirmDelete(null);
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
          Νέος κωδικός
        </button>
      </div>

      {editing === "new" && (
        <div className="mb-4">
          <DiscountForm pending={pending} onCancel={() => setEditing(null)} onSave={(d) => run(() => saveDiscountAction(d))} />
        </div>
      )}

      {discounts.length === 0 && editing !== "new" ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium text-ink">Δεν υπάρχουν κωδικοί έκπτωσης</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
            Δημιούργησε έναν κωδικό που οι πελάτες μπορούν να εισάγουν στο καλάθι τους.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {discounts.map((d) => (
            <div key={d.id} className="border-b border-border last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-surface">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded-sm bg-surface-strong px-2 py-0.5 font-mono text-sm font-medium text-ink">
                      {d.code}
                    </code>
                    <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${STATE[d.state].cls}`}>
                      {STATE[d.state].label}
                    </span>
                  </div>
                  {d.description && <div className="mt-0.5 text-xs text-ink-muted">{d.description}</div>}
                  {d.ownerCustomerEmail && (
                    <div className="mt-0.5 text-xs font-medium text-accent">
                      Προσωπικό κουπόνι πιστότητας — {d.ownerCustomerEmail}
                    </div>
                  )}
                </div>

                <div className="text-sm font-medium tabular-nums text-ink">
                  {d.type === "percentage" ? `−${d.value}%` : `−${money(d.value)}`}
                </div>

                <div className="text-xs text-ink-muted">
                  {d.minSubtotalCents > 0 && <>Ελάχ. {money(d.minSubtotalCents)} · </>}
                  {(() => {
                    const uses =
                      d.maxRedemptions != null
                        ? `${d.redemptionCount}/${d.maxRedemptions} χρήσεις`
                        : `${d.redemptionCount} χρήσεις`;
                    // Clickable only when there is something to list.
                    return d.redemptionCount > 0 ? (
                      <button
                        type="button"
                        aria-expanded={usageOf === d.id}
                        onClick={() => setUsageOf(usageOf === d.id ? null : d.id)}
                        className="underline decoration-dotted underline-offset-2 hover:text-ink"
                      >
                        {uses} {usageOf === d.id ? "▴" : "▾"}
                      </button>
                    ) : (
                      uses
                    );
                  })()}
                  {d.endsAt && <> · έως {date.format(new Date(d.endsAt))}</>}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(d.id)}
                    className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface"
                  >
                    Επεξεργασία
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(d)}
                    className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-danger/5 hover:text-danger"
                  >
                    Διαγραφή
                  </button>
                </div>
              </div>

              {usageOf === d.id && (
                <div className="border-t border-border bg-surface/40 px-4 py-3">
                  <DiscountUsageList discountId={d.id} />
                </div>
              )}

              {editing === d.id && (
                <div className="border-t border-border bg-surface/40 px-4 py-4">
                  <DiscountForm
                    discount={d}
                    pending={pending}
                    onCancel={() => setEditing(null)}
                    onSave={(data) => run(() => saveDiscountAction(data))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <button type="button" aria-label="Άκυρο" onClick={() => setConfirmDelete(null)} className="absolute inset-0 bg-ink/30" />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-lg border border-border bg-bg p-6">
            <h2 className="font-display text-lg text-ink">Διαγραφή κωδικού</h2>
            <p className="mt-2 text-sm text-ink-muted">
              {confirmDelete.redemptionCount > 0 ? (
                <>
                  Ο κωδικός <strong className="text-ink">{confirmDelete.code}</strong> έχει χρησιμοποιηθεί σε{" "}
                  {confirmDelete.redemptionCount} παραγγελίες, οπότε θα{" "}
                  <strong className="text-ink">απενεργοποιηθεί</strong> αντί να διαγραφεί — το ιστορικό των
                  παραγγελιών παραμένει ακέραιο.
                </>
              ) : (
                <>
                  Ο κωδικός <strong className="text-ink">{confirmDelete.code}</strong> δεν έχει χρησιμοποιηθεί
                  και θα διαγραφεί οριστικά.
                </>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-md border border-border px-3.5 py-2 text-sm font-medium hover:bg-surface"
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => deleteDiscountAction(confirmDelete.id))}
                className="rounded-md bg-danger px-3.5 py-2 text-sm font-medium text-bg hover:bg-danger/90 disabled:opacity-50"
              >
                {confirmDelete.redemptionCount > 0 ? "Απενεργοποίηση" : "Διαγραφή"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Which orders used a code, newest first (the last 20), loaded when the
 * "N χρήσεις" count is opened. An order deleted permanently since no longer
 * appears here, though it still counts toward the number of uses.
 */
function DiscountUsageList({ discountId }: { discountId: string }) {
  const [state, setState] = useState<{ usage?: DiscountUsage[]; error?: string }>({});

  useEffect(() => {
    let current = true;
    void getDiscountUsageAction(discountId).then((result) => {
      if (current) setState(result.ok ? { usage: result.usage } : { error: result.error });
    });
    return () => {
      current = false;
    };
  }, [discountId]);

  if (state.error) return <p className="text-xs text-danger">{state.error}</p>;
  if (!state.usage) return <p className="text-xs text-ink-muted">Φόρτωση…</p>;
  if (state.usage.length === 0) {
    return <p className="text-xs text-ink-muted">Οι παραγγελίες με αυτόν τον κωδικό έχουν διαγραφεί.</p>;
  }

  return (
    <ul className="flex flex-col gap-1 text-xs">
      {state.usage.map((u) => (
        <li key={u.orderId} className="flex flex-wrap items-baseline gap-x-3">
          <Link href={`/admin/orders/${u.orderId}`} className="font-medium text-ink underline hover:text-accent">
            #{u.orderNumber}
          </Link>
          <span className="tabular-nums text-ink-muted">{date.format(new Date(u.createdAt))}</span>
          <span className="text-ink">{u.customerEmail}</span>
          <span className="tabular-nums text-ink">{money(u.totalCents)}</span>
        </li>
      ))}
    </ul>
  );
}

function DiscountForm({
  discount,
  pending,
  onCancel,
  onSave,
}: {
  discount?: AdminDiscount;
  pending: boolean;
  onCancel: () => void;
  onSave: (data: FormData) => void;
}) {
  const [type, setType] = useState<AdminDiscount["type"]>(discount?.type ?? "percentage");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        if (discount) data.set("id", discount.id);
        onSave(data);
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Κωδικός</label>
          <input
            name="code"
            defaultValue={discount?.code ?? ""}
            required
            autoFocus
            placeholder="ΚΑΛΟΚΑΙΡΙ10"
            className={`${field} font-mono uppercase`}
          />
          <p className="text-xs text-ink-muted">Οι πελάτες τον πληκτρολογούν στο καλάθι. Δεν έχει σημασία η κεφαλαιοποίηση.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Περιγραφή</label>
          <input name="description" defaultValue={discount?.description ?? ""} className={field} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Τύπος</label>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as AdminDiscount["type"])}
            className={field}
          >
            <option value="percentage">Ποσοστό (%)</option>
            <option value="fixed">Σταθερό ποσό (€)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">
            {type === "percentage" ? "Ποσοστό" : "Ποσό (€)"}
          </label>
          <input
            name="value"
            defaultValue={
              discount ? (discount.type === "percentage" ? discount.value : centsToPriceInput(discount.value)) : ""
            }
            inputMode="decimal"
            required
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Ελάχιστο καλάθι (€)</label>
          <input
            name="minSubtotal"
            defaultValue={discount && discount.minSubtotalCents > 0 ? centsToPriceInput(discount.minSubtotalCents) : ""}
            inputMode="decimal"
            placeholder="0,00"
            className={field}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Έναρξη</label>
          <input type="date" name="startsAt" defaultValue={forInput(discount?.startsAt ?? null)} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Λήξη</label>
          <input type="date" name="endsAt" defaultValue={forInput(discount?.endsAt ?? null)} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Μέγιστες χρήσεις</label>
          <input
            name="maxRedemptions"
            defaultValue={discount?.maxRedemptions ?? ""}
            inputMode="numeric"
            placeholder="Απεριόριστες"
            className={field}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="isActive" defaultChecked={discount?.isActive ?? true} className="h-4 w-4 accent-ink" />
        Ενεργός
      </label>

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
