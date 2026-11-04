"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkProductAction, quickEditProductAction, type BulkOperation } from "@/lib/admin/catalog-actions";
import type { AdminProductRow } from "@/lib/admin/products";
import { money } from "@/components/admin/ui/primitives";
import { formatMetres, stepsToMetres } from "@/lib/length";

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


function priceRange(row: AdminProductRow): string {
  if (row.minPriceCents == null) return "—";
  if (row.maxPriceCents == null || row.minPriceCents === row.maxPriceCents) return money(row.minPriceCents);
  return `${money(row.minPriceCents)} – ${money(row.maxPriceCents)}`;
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
              <Th>Κωδικός</Th>
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
                    <div className="flex items-center gap-3">
                      {/* The photo opens the editor — the name is now the quick edit. */}
                      <Link href={`/admin/products/${p.id}`} tabIndex={-1} aria-hidden className="shrink-0">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin-only thumbnail, same as CategoryProductOrder
                          <img
                            src={p.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-10 w-10 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md border border-border bg-surface" />
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <InlineEdit
                          label={`Όνομα: ${p.title}`}
                          initial={p.title}
                          onSave={(value) => quickEditProductAction(p.id, { field: "title", value })}
                          className="font-medium text-ink"
                          inputClassName="w-full min-w-[16rem]"
                        >
                          {p.title}
                        </InlineEdit>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                          <span>/{p.slug}</span>
                          {p.variantCount > 1 && <span>· {p.variantCount} παραλλαγές</span>}
                          {p.imageCount === 0 && <span className="text-accent">· χωρίς εικόνα</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap border-b border-border px-4 py-3 tabular-nums text-ink">{p.code ?? "—"}</td>
                  <td className="border-b border-border px-4 py-3 text-ink-muted">{p.categoryName ?? "—"}</td>
                  <td className="whitespace-nowrap border-b border-border px-4 py-3 text-right tabular-nums">
                    {p.variantCount === 1 && p.minPriceCents != null ? (
                      <InlineEdit
                        label={`Τιμή: ${p.title}`}
                        initial={centsToInput(p.minPriceCents)}
                        onSave={(value) => quickEditProductAction(p.id, { field: "price", value })}
                        inputMode="decimal"
                        align="right"
                        inputClassName="w-24"
                        suffix={p.lengthStepCm != null ? "€/μ" : "€"}
                      >
                        {priceRange(p)}
                        {p.lengthStepCm != null && <span className="text-ink-muted">/μ</span>}
                      </InlineEdit>
                    ) : (
                      <VariantsLink id={p.id}>{priceRange(p)}</VariantsLink>
                    )}
                    {p.onSale && <span className="ml-1.5 text-xs text-accent">σε προσφορά</span>}
                  </td>
                  <td
                    className={`whitespace-nowrap border-b border-border px-4 py-3 text-right tabular-nums ${
                      p.totalStock <= 0 ? "text-danger" : p.totalStock <= 5 ? "text-accent" : ""
                    }`}
                  >
                    {p.variantCount === 1 ? (
                      <InlineEdit
                        label={`Απόθεμα: ${p.title}`}
                        initial={
                          p.lengthStepCm != null
                            ? String(stepsToMetres(p.totalStock, p.lengthStepCm)).replace(".", ",")
                            : String(p.totalStock)
                        }
                        onSave={(value) =>
                          quickEditProductAction(p.id, { field: "stock", value, expected: p.totalStock })
                        }
                        inputMode={p.lengthStepCm != null ? "decimal" : "numeric"}
                        align="right"
                        inputClassName="w-20"
                        suffix={p.lengthStepCm != null ? "μ" : undefined}
                      >
                        {p.lengthStepCm != null ? formatMetres(p.totalStock, p.lengthStepCm) : p.totalStock}
                      </InlineEdit>
                    ) : (
                      <VariantsLink id={p.id}>
                        {p.lengthStepCm != null ? formatMetres(p.totalStock, p.lengthStepCm) : p.totalStock}
                      </VariantsLink>
                    )}
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    <StatusToggle id={p.id} title={p.title} isActive={p.isActive} />
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

// "24,90" — what the owner types (Greek keyboards give a comma); priceToCents
// on the server reads either separator.
function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * A list cell that turns into an input on click. Enter or clicking away
 * saves (only if the value changed), Escape cancels. On an error the input
 * stays open with the reason underneath, so nothing typed is lost.
 */
function InlineEdit({
  label,
  initial,
  onSave,
  children,
  className = "",
  inputClassName = "",
  inputMode,
  align = "left",
  suffix,
}: {
  label: string;
  initial: string;
  onSave: (value: string) => Promise<{ ok: true; message?: string } | { ok: false; error: string }>;
  children: React.ReactNode;
  className?: string;
  inputClassName?: string;
  inputMode?: "decimal" | "numeric";
  align?: "left" | "right";
  suffix?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setValue(initial);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function commit() {
    if (pending) return;
    if (value.trim() === initial.trim()) return cancel();
    startTransition(async () => {
      const result = await onSave(value);
      if (result.ok) {
        setEditing(false);
        setError(null);
        router.refresh();
      } else {
        setError(result.error);
        // stale_stock refreshed the list on the server; pick the new number up.
        router.refresh();
      }
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        title="Κλικ για αλλαγή"
        aria-label={`Αλλαγή — ${label}`}
        className={`rounded-sm text-${align} underline decoration-transparent decoration-dashed underline-offset-4 transition-colors hover:decoration-ink-muted focus-visible:decoration-ink-muted ${className}`}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={align === "right" ? "flex flex-col items-end" : ""}>
      <div className="inline-flex items-center gap-1">
        <input
          autoFocus
          aria-label={label}
          value={value}
          inputMode={inputMode}
          disabled={pending}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className={`rounded-md border border-ink bg-bg px-2 py-1 text-sm tabular-nums outline-none disabled:opacity-50 text-${align} ${inputClassName}`}
        />
        {suffix && <span className="text-xs text-ink-muted">{suffix}</span>}
      </div>
      {pending && <div className="mt-1 text-xs text-ink-muted">Αποθήκευση…</div>}
      {error && (
        <div role="alert" className="mt-1 max-w-[18rem] whitespace-normal text-left text-xs text-danger">
          {error}
        </div>
      )}
    </div>
  );
}

/** Price/stock of a product with several variants: each variant has its own, edited in the product. */
function VariantsLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/admin/products/${id}`}
      title="Έχει παραλλαγές — άλλαξέ το μέσα στο προϊόν"
      className="hover:text-accent"
    >
      {children}
    </Link>
  );
}

/** One click switches Ενεργό ↔ Ανενεργό — as easy to undo as to do, so no confirmation. */
function StatusToggle({ id, title, isActive }: { id: string; title: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await quickEditProductAction(id, { field: "active", value: !isActive });
            setError(result.ok ? null : result.error);
            if (result.ok) router.refresh();
          })
        }
        title={isActive ? "Κλικ για απενεργοποίηση" : "Κλικ για ενεργοποίηση"}
        aria-label={`${isActive ? "Απενεργοποίηση" : "Ενεργοποίηση"}: ${title}`}
        className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-75 disabled:opacity-50 ${
          isActive ? "bg-success/10 text-success" : "bg-surface text-ink-muted"
        }`}
      >
        {pending ? "…" : isActive ? "Ενεργό" : "Ανενεργό"}
      </button>
      {error && <div role="alert" className="mt-1 text-xs text-danger">{error}</div>}
    </div>
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
