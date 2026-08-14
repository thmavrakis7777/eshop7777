"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkProductAction, type BulkOperation } from "@/lib/admin/catalog-actions";
import type { AdminProductRow } from "@/lib/admin/products";

/**
 * The product list, with bulk selection.
 *
 * Client-side only for selection state and the confirm dialog — the rows
 * themselves are rendered from server-fetched data passed in as props, and
 * filtering/sorting/paging all happen as URL navigations so every view is
 * linkable and the back button works.
 *
 * Destructive bulk operations require typed confirmation. The brief asks for
 * confirmation on dangerous bulk actions; "click OK" is not confirmation when
 * the action can rewrite 200 prices, so the count has to be typed back.
 */

const money = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" });
const fmt = (cents: number) => money.format(cents / 100);

function priceRange(row: AdminProductRow): string {
  if (row.minPriceCents == null) return "—";
  if (row.maxPriceCents == null || row.minPriceCents === row.maxPriceCents) return fmt(row.minPriceCents);
  return `${fmt(row.minPriceCents)} – ${fmt(row.maxPriceCents)}`;
}

type Option = { id: string; name?: string; title?: string; depth?: number };

export function ProductListTable({
  products,
  categories,
  collections,
}: {
  products: AdminProductRow[];
  categories: Option[];
  collections: Option[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<BulkOperation | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const allSelected = products.length > 0 && selected.size === products.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(op: BulkOperation) {
    const ids = [...selected];
    startTransition(async () => {
      const result = await bulkProductAction(ids, op);
      setFeedback(result.ok ? { ok: true, text: result.message ?? "Έγινε." } : { ok: false, text: result.error });
      if (result.ok) {
        setSelected(new Set());
        router.refresh();
      }
      setConfirming(null);
      setConfirmText("");
    });
  }

  // Only operations that rewrite prices, stock or existence need typed
  // confirmation. Activating a product is a click away from being undone.
  function request(op: BulkOperation) {
    const needsConfirm = op.kind === "archive" || op.kind === "price" || op.kind === "stock";
    if (needsConfirm) {
      setConfirming(op);
      setConfirmText("");
    } else {
      run(op);
    }
  }

  return (
    <>
      {feedback && (
        <div
          role="status"
          className={`mb-4 rounded-md border px-4 py-2.5 text-sm ${
            feedback.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-ink bg-bg px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-ink">{selected.size} επιλεγμένα</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <BulkButton onClick={() => request({ kind: "activate" })} disabled={pending}>
              Ενεργοποίηση
            </BulkButton>
            <BulkButton onClick={() => request({ kind: "deactivate" })} disabled={pending}>
              Απενεργοποίηση
            </BulkButton>

            <select
              aria-label="Μαζική αλλαγή κατηγορίας"
              className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) request({ kind: "category", categoryId: e.target.value });
                e.target.value = "";
              }}
              disabled={pending}
            >
              <option value="">Κατηγορία…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {"— ".repeat(c.depth ?? 0)}
                  {c.name}
                </option>
              ))}
            </select>

            {collections.length > 0 && (
              <select
                aria-label="Μαζική προσθήκη σε συλλογή"
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) request({ kind: "collection", collectionId: e.target.value });
                  e.target.value = "";
                }}
                disabled={pending}
              >
                <option value="">Συλλογή…</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}

            <BulkButton
              onClick={() => {
                const raw = window.prompt("Μεταβολή τιμής σε % (π.χ. -10 για έκπτωση 10%)");
                const value = Number(raw?.replace(",", "."));
                if (Number.isFinite(value) && value !== 0) request({ kind: "price", mode: "percent", value });
              }}
              disabled={pending}
            >
              Τιμή %
            </BulkButton>

            <BulkButton
              onClick={() => {
                const raw = window.prompt("Νέο απόθεμα για όλες τις παραλλαγές");
                const q = Number(raw);
                if (Number.isInteger(q) && q >= 0) request({ kind: "stock", quantity: q });
              }}
              disabled={pending}
            >
              Απόθεμα
            </BulkButton>

            <button
              type="button"
              onClick={() => request({ kind: "archive" })}
              disabled={pending}
              className="rounded-md border border-danger/40 px-2.5 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/5 disabled:opacity-50"
            >
              Διαγραφή
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          count={selected.size}
          op={confirming}
          value={confirmText}
          onChange={setConfirmText}
          onCancel={() => {
            setConfirming(null);
            setConfirmText("");
          }}
          onConfirm={() => run(confirming)}
          pending={pending}
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-10 border-b border-border bg-surface px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Επιλογή όλων"
                  className="h-4 w-4 accent-ink"
                />
              </th>
              <Th>Προϊόν</Th>
              <Th>Κατηγορία</Th>
              <Th align="right">Τιμή</Th>
              <Th align="right">Απόθεμα</Th>
              <Th>Κατάσταση</Th>
              <th className="w-10 border-b border-border bg-surface" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <tr
                  key={p.id}
                  className={`transition-colors ${isSelected ? "bg-surface-strong/60" : "hover:bg-surface"}`}
                >
                  <td className="border-b border-border px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(p.id)}
                      aria-label={`Επιλογή ${p.title}`}
                      className="h-4 w-4 accent-ink"
                    />
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="font-medium text-ink hover:text-accent">
                      {p.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                      <span>/{p.slug}</span>
                      {p.variantCount > 1 && <span>· {p.variantCount} παραλλαγές</span>}
                      {p.imageCount === 0 && <span className="text-accent">· χωρίς εικόνα</span>}
                    </div>
                  </td>
                  <td className="border-b border-border px-4 py-3 text-ink-muted">{p.categoryName ?? "—"}</td>
                  <td className="border-b border-border px-4 py-3 text-right tabular-nums">
                    {priceRange(p)}
                    {p.onSale && <span className="ml-1.5 text-xs text-accent">σε προσφορά</span>}
                  </td>
                  <td
                    className={`border-b border-border px-4 py-3 text-right tabular-nums ${
                      p.totalStock <= 0 ? "text-danger" : p.totalStock <= 5 ? "text-accent" : ""
                    }`}
                  >
                    {p.totalStock}
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
                        p.isActive ? "bg-success/10 text-success" : "bg-surface text-ink-muted"
                      }`}
                    >
                      {p.isActive ? "Ενεργό" : "Ανενεργό"}
                    </span>
                  </td>
                  <td className="border-b border-border px-2 py-3 text-right">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="text-ink-muted hover:text-ink"
                      aria-label={`Επεξεργασία ${p.title}`}
                    >
                      →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={`border-b border-border bg-surface px-4 py-2.5 text-xs font-semibold text-ink-muted text-${align}`}
    >
      {children}
    </th>
  );
}

function BulkButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-border px-2.5 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:opacity-50"
    >
      {children}
    </button>
  );
}

const OP_DESCRIPTIONS: Record<string, (op: BulkOperation, n: number) => string> = {
  archive: (_o, n) => `Θα διαγραφούν ${n} προϊόντα. Όσα έχουν παραγγελίες θα απενεργοποιηθούν αντί να διαγραφούν.`,
  price: (o, n) =>
    o.kind === "price"
      ? `Θα αλλάξουν οι τιμές σε ${n} προϊόντα κατά ${o.value > 0 ? "+" : ""}${o.value}%.`
      : "",
  stock: (o, n) => (o.kind === "stock" ? `Θα οριστεί απόθεμα ${o.quantity} σε ${n} προϊόντα.` : ""),
};

function ConfirmDialog({
  count,
  op,
  value,
  onChange,
  onCancel,
  onConfirm,
  pending,
}: {
  count: number;
  op: BulkOperation;
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const description = OP_DESCRIPTIONS[op.kind]?.(op, count) ?? "";
  // Typing the count back proves the number was read. A plain "are you sure?"
  // gets clicked through; this does not.
  const matches = value.trim() === String(count);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <button type="button" aria-label="Άκυρο" onClick={onCancel} className="absolute inset-0 bg-ink/30" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-md rounded-lg border border-border bg-bg p-6"
      >
        <h2 id="confirm-title" className="font-display text-lg text-ink">
          Επιβεβαίωση
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{description}</p>
        <label htmlFor="confirm-input" className="mt-4 block text-sm text-ink">
          Πληκτρολόγησε <strong className="tabular-nums">{count}</strong> για επιβεβαίωση
        </label>
        <input
          id="confirm-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          inputMode="numeric"
          className="mt-1.5 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface"
          >
            Άκυρο
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || pending}
            className="rounded-md bg-danger px-3.5 py-2 text-sm font-medium text-bg transition-colors hover:bg-danger/90 disabled:opacity-40"
          >
            {pending ? "Εκτέλεση…" : "Επιβεβαίωση"}
          </button>
        </div>
      </div>
    </div>
  );
}
