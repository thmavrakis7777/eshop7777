"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { changeStockByAction, setStockAction } from "@/lib/admin/taxonomy-actions";
import type { InventoryRow } from "@/lib/admin/taxonomy";

/**
 * Inventory: edit stock inline, without opening each product.
 *
 * "Δεσμευμένα" is stock sitting in active carts. It is NOT subtracted from
 * the on-hand figure — the order-completion transaction is what actually
 * decrements stock, and pretending a cart is a reservation here would
 * misreport what is on the shelf. It is shown because it explains why a
 * number might be about to drop.
 *
 * Two ways to change a number: −/+ for the everyday one-off (sold one in
 * the shop, found one in the back), saved on their own with no button, and
 * "Αλλαγή" for typing an exact figure when a delivery arrives.
 */

// Long enough to gather a run of quick clicks into one save (and one line of
// stock history), short enough that the number is stored before anyone
// thinks to leave the page.
const SAVE_DELAY_MS = 500;

// Per row: clicks waiting for the delay, the change currently being saved,
// and the stock the server last reported for this row.
type Nudge = { queued: number; inflight: number; confirmed?: number };

/**
 * The −/+ buttons' bookkeeping. The number moves the moment you click;
 * the server is told the CHANGE (changeStockByAction), never a target
 * number, so fast clicks can't overwrite each other. Clicks made while a
 * save is in flight are sent as the next save, never dropped.
 */
function useStockNudges(onError: (text: string) => void) {
  const router = useRouter();
  const [nudges, setNudges] = useState<Record<string, Nudge>>({});
  // Mirror of `nudges` for the async save loop, which would otherwise read
  // the state from the render it started in.
  const current = useRef(nudges);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  function update(id: string, fn: (n: Nudge) => Nudge) {
    const next = { ...current.current, [id]: fn(current.current[id] ?? { queued: 0, inflight: 0 }) };
    current.current = next;
    setNudges(next);
  }

  async function flush(id: string) {
    timers.current.delete(id);
    const n = current.current[id];
    if (!n || n.inflight !== 0 || n.queued === 0) return;
    const delta = n.queued;
    update(id, (x) => ({ ...x, queued: 0, inflight: delta }));

    const result = await changeStockByAction(id, delta).catch(() => ({
      ok: false as const,
      error: "Κάτι πήγε στραβά. Δοκίμασε ξανά.",
    }));
    if (result.ok) {
      update(id, (x) => ({ ...x, inflight: 0, confirmed: result.stock }));
    } else {
      // Unknown whether the server applied it — drop what this screen
      // believes and reload the real figure rather than guess.
      update(id, (x) => ({ ...x, inflight: 0, confirmed: undefined }));
      onError(result.error);
      router.refresh();
    }
    if ((current.current[id]?.queued ?? 0) !== 0) void flush(id);
  }

  function nudge(id: string, by: 1 | -1, shown: number) {
    if (shown + by < 0) return;
    update(id, (x) => ({ ...x, queued: x.queued + by }));
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => void flush(id), SAVE_DELAY_MS));
  }

  /** After an exact "Αλλαγή" save, the reloaded row is the truth again. */
  function forget(id: string) {
    update(id, () => ({ queued: 0, inflight: 0 }));
  }

  const anyPending = Object.values(nudges).some((n) => n.queued !== 0 || n.inflight !== 0);

  // Leaving within the save delay: navigating inside the admin saves at
  // once (unmount below); closing the tab gets the browser's own "leave
  // page?" prompt, because an unsent click can't be rescued from there.
  useEffect(() => {
    if (!anyPending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyPending]);

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      for (const [id, timer] of pendingTimers) {
        clearTimeout(timer);
        void flush(id);
      }
    };
    // Unmount only — flush reads everything it needs from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function view(row: InventoryRow) {
    const n = nudges[row.variantId];
    const shown = (n?.confirmed ?? row.stock) + (n?.queued ?? 0) + (n?.inflight ?? 0);
    return { shown, saving: Boolean(n && (n.queued !== 0 || n.inflight !== 0)) };
  }

  return { nudge, forget, view };
}

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const stock = useStockNudges((text) => setMsg({ ok: false, text }));

  // The list arrives lowest-stock-first, and every save reloads it — so
  // without this a row would jump away from under the cursor after a +.
  // Rows keep the order they had when the page opened (the page remounts
  // this table on a new tab or search, which re-sorts).
  const [order] = useState(() => new Map(rows.map((r, i) => [r.variantId, i])));
  const sorted = [...rows].sort(
    (a, b) => (order.get(a.variantId) ?? Infinity) - (order.get(b.variantId) ?? Infinity)
  );

  function save(variantId: string) {
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setMsg({ ok: false, text: "Το απόθεμα πρέπει να είναι μη αρνητικός ακέραιος." });
      return;
    }
    startTransition(async () => {
      const result = await setStockAction(variantId, quantity);
      setMsg(result.ok ? { ok: true, text: result.message ?? "Ενημερώθηκε." } : { ok: false, text: result.error });
      if (result.ok) {
        setEditing(null);
        stock.forget(variantId);
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

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr>
              <Th>Προϊόν</Th>
              <Th>SKU</Th>
              <Th align="right">Δεσμευμένα</Th>
              <Th align="right">Απόθεμα</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const { shown, saving } = stock.view(r);
              const tone =
                r.allowBackorder ? "text-ink-muted"
                  : shown <= 0 ? "text-danger"
                  : shown <= 5 ? "text-accent"
                  : "text-ink";
              return (
                <tr key={r.variantId} className="transition-colors hover:bg-surface">
                  <td className="border-b border-border px-4 py-2.5">
                    <Link href={`/admin/products/${r.productId}`} className="font-medium text-ink hover:text-accent">
                      {r.productTitle}
                    </Link>
                    {r.hasSiblings && (
                      <span className="ml-2 text-xs text-ink-muted">{r.variantTitle}</span>
                    )}
                    {!r.isActive && <span className="ml-2 text-xs text-ink-muted">(ανενεργό)</span>}
                  </td>
                  <td className="border-b border-border px-4 py-2.5 font-mono text-xs text-ink-muted">{r.sku}</td>
                  <td className="border-b border-border px-4 py-2.5 text-right tabular-nums text-ink-muted">
                    {r.reservedInCarts > 0 ? r.reservedInCarts : "—"}
                  </td>
                  <td className={`border-b border-border px-4 py-2 text-right tabular-nums ${tone}`}>
                    {editing === r.variantId ? (
                      <input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") save(r.variantId);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        autoFocus
                        inputMode="numeric"
                        aria-label={`Απόθεμα για ${r.sku}`}
                        className="w-20 rounded-md border border-ink bg-bg px-2 py-1 text-right text-sm outline-none"
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <StepButton
                          label={`Μείωση αποθέματος για ${r.sku}`}
                          disabled={shown <= 0}
                          onClick={() => stock.nudge(r.variantId, -1, shown)}
                        >
                          −
                        </StepButton>
                        <span className="min-w-[3ch] text-center font-medium">{shown}</span>
                        <StepButton
                          label={`Αύξηση αποθέματος για ${r.sku}`}
                          onClick={() => stock.nudge(r.variantId, 1, shown)}
                        >
                          +
                        </StepButton>
                        {/* Fixed-size slot so the row doesn't shift when it appears. */}
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 rounded-full ${saving ? "animate-pulse bg-accent" : "bg-transparent"}`}
                        />
                        {saving && <span className="sr-only">Αποθήκευση…</span>}
                        {r.allowBackorder && <span className="text-xs">(backorder)</span>}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-border px-3 py-2.5 text-right">
                    {editing === r.variantId ? (
                      <span className="flex justify-end gap-1">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => save(r.variantId)}
                          className="rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-bg disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="rounded-md border border-border px-2.5 py-1 text-xs"
                        >
                          Άκυρο
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        // Waits for this row's −/+ to finish saving, so the
                        // box never opens on a number that is about to change.
                        disabled={saving}
                        onClick={() => {
                          setEditing(r.variantId);
                          setValue(String(shown));
                        }}
                        className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface disabled:opacity-50"
                      >
                        Αλλαγή
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Τα − / + αποθηκεύονται αυτόματα. Κάθε αλλαγή αποθέματος καταγράφεται με τον χρήστη που την έκανε.
      </p>
    </>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-base leading-none text-ink transition-colors hover:bg-surface active:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={`border-b border-border bg-surface px-4 py-2.5 text-xs font-semibold text-ink-muted text-${align}`}
    >
      {children}
    </th>
  );
}
