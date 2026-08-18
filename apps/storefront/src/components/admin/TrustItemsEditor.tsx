"use client";

import { useState } from "react";
import type { TrustIconName, TrustItem } from "@/lib/content-types";

/**
 * Editor for the guarantee tiles.
 *
 * Rows submit as flat indexed fields (item-0-title, item-0-icon, …) rather
 * than as serialised JSON, so the Server Action validates each value on its
 * own and a hand-crafted post can't smuggle in an arbitrary object.
 */

const ICON_CHOICES: Array<{ value: TrustIconName; label: string }> = [
  { value: "truck", label: "🚚 Παράδοση" },
  { value: "returns", label: "↩ Επιστροφές" },
  { value: "payment", label: "💳 Πληρωμή" },
  { value: "support", label: "🕘 Εξυπηρέτηση" },
  { value: "shield", label: "🛡 Ασφάλεια" },
  { value: "phone", label: "☎ Τηλέφωνο" },
  { value: "gift", label: "🎁 Δώρο" },
  { value: "leaf", label: "🌿 Οικολογικό" },
];

const MAX_ITEMS = 8;

const EMPTY: TrustItem = { icon: "truck", title: "", description: "", visible: true };

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

export function TrustItemsEditor({ defaultItems }: { defaultItems: TrustItem[] }) {
  const [items, setItems] = useState<TrustItem[]>(
    defaultItems.length > 0 ? defaultItems : [EMPTY]
  );

  const update = (i: number, patch: Partial<TrustItem>) =>
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const move = (i: number, dir: -1 | 1) => {
    const target = i + dir;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-ink">Εγγυήσεις</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Γράψε μόνο ό,τι το κατάστημα κάνει πραγματικά — αυτές οι υποσχέσεις πρέπει να ταιριάζουν με
          το τι προσφέρει το checkout (τρόποι πληρωμής, χρόνοι παράδοσης, επιστροφές).
        </p>
      </div>

      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink-muted">Εγγύηση {i + 1}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`Μετακίνηση πάνω: εγγύηση ${i + 1}`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="h-6 w-6 rounded-sm border border-border text-ink disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Μετακίνηση κάτω: εγγύηση ${i + 1}`}
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
                className="h-6 w-6 rounded-sm border border-border text-ink disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Διαγραφή: εγγύηση ${i + 1}`}
                onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-sm px-2 py-0.5 text-xs text-danger hover:bg-danger/5"
              >
                Διαγραφή
              </button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[10rem_1fr]">
            <label className="sr-only" htmlFor={`item-${i}-icon`}>
              Εικονίδιο εγγύησης {i + 1}
            </label>
            <select
              id={`item-${i}-icon`}
              name={`item-${i}-icon`}
              value={item.icon}
              onChange={(e) => update(i, { icon: e.target.value as TrustIconName })}
              className={field}
            >
              {ICON_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor={`item-${i}-title`}>
              Τίτλος εγγύησης {i + 1}
            </label>
            <input
              id={`item-${i}-title`}
              name={`item-${i}-title`}
              value={item.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="Παράδοση σε 2-3 εργάσιμες"
              className={field}
            />
          </div>

          <label className="sr-only" htmlFor={`item-${i}-description`}>
            Περιγραφή εγγύησης {i + 1}
          </label>
          <input
            id={`item-${i}-description`}
            name={`item-${i}-description`}
            value={item.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="Σε όλη την Ελλάδα, με courier συνεργάτη"
            className={`${field} mt-2`}
          />

          <label className="mt-2 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name={`item-${i}-visible`}
              checked={item.visible}
              onChange={(e) => update(i, { visible: e.target.checked })}
              className="h-4 w-4 accent-ink"
            />
            Ορατή
          </label>
        </div>
      ))}

      {items.length < MAX_ITEMS && (
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, { ...EMPTY }])}
          className="self-start rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-ink hover:bg-surface"
        >
          + Προσθήκη εγγύησης
        </button>
      )}

      <p className="text-xs text-ink-muted">
        Άδειος τίτλος = η εγγύηση δεν αποθηκεύεται. Καμία εγγύηση = χρησιμοποιούνται οι
        προεπιλεγμένες.
      </p>
    </div>
  );
}
