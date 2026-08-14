"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setStockAction } from "@/lib/admin/taxonomy-actions";
import type { InventoryRow } from "@/lib/admin/taxonomy";

/**
 * Inventory: edit stock inline, without opening each product.
 *
 * "Δεσμευμένα" is stock sitting in active carts. It is NOT subtracted from
 * the on-hand figure — the order-completion transaction is what actually
 * decrements stock, and pretending a cart is a reservation here would
 * misreport what is on the shelf. It is shown because it explains why a
 * number might be about to drop.
 */
export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
            {rows.map((r) => {
              const tone =
                r.allowBackorder ? "text-ink-muted"
                  : r.stock <= 0 ? "text-danger"
                  : r.stock <= 5 ? "text-accent"
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
                  <td className={`border-b border-border px-4 py-2.5 text-right tabular-nums ${tone}`}>
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
                      <>
                        {r.stock}
                        {r.allowBackorder && <span className="ml-1.5 text-xs">(backorder)</span>}
                      </>
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
                        onClick={() => {
                          setEditing(r.variantId);
                          setValue(String(r.stock));
                        }}
                        className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface"
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
        Κάθε αλλαγή αποθέματος καταγράφεται με τον χρήστη που την έκανε.
      </p>
    </>
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
