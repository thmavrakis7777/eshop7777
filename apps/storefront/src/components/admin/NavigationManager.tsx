"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteNavItemAction,
  moveNavItemAction,
  saveNavItemAction,
  setNavItemActiveAction,
} from "@/lib/admin/nav-actions";
import type { AdminNavItem } from "@/lib/admin/navigation";
import type { NavDestinationType } from "@/lib/data/navigation";

/**
 * The main navigation, as an ordered list the owner composes.
 *
 * Deliberately the same shape as the homepage section builder — list,
 * per-row Edit/Hide/Move/Delete, one inline form — so the two screens teach
 * the same mental model instead of each inventing its own.
 */

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";
const labelCls = "block text-xs font-medium text-ink-muted mb-1";

const DEST_LABELS: Record<NavDestinationType, string> = {
  category: "Κατηγορία",
  collection: "Συλλογή",
  product: "Προϊόν",
  new_arrivals: "Νέες αφίξεις",
  sale: "Προσφορές",
  custom: "Άλλη διεύθυνση",
};

/** These resolve to fixed routes, so they take no destination value. */
const VALUELESS: NavDestinationType[] = ["new_arrivals", "sale"];

const HEX = /^#[0-9a-fA-F]{6}$/;

export type NavPickerOption = { slug: string; label: string };

/**
 * Relative luminance per WCAG, used to warn when a colour pair would be hard
 * to read. A warning, not a block: refusing to save a combination the owner
 * can read perfectly well would be patronising, and they may be mid-edit.
 */
function luminance(hex: string): number {
  const v = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function NavigationManager({
  items,
  categories,
  collections,
}: {
  items: AdminNavItem[];
  categories: NavPickerOption[];
  collections: NavPickerOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminNavItem | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      setMsg(
        r.ok
          ? { ok: true, text: r.message ?? "Έγινε." }
          : { ok: false, text: r.error ?? "Κάτι πήγε στραβά." }
      );
      if (r.ok) {
        setEditing(null);
        setAdding(false);
        setConfirmDelete(null);
        router.refresh();
      }
    });
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Πλοήγηση</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Η μπάρα του καταστήματος. {items.length} στοιχεία,{" "}
          {items.filter((i) => i.isActive).length} ορατά.
          {items.length === 0 && " Χωρίς στοιχεία, εμφανίζονται αυτόματα οι κύριες κατηγορίες."}
        </p>
      </div>

      {msg && (
        <p
          role="status"
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            msg.ok
              ? "border-success/30 bg-success/5 text-success"
              : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="mb-6 rounded-lg border border-dashed border-border p-4">
        {adding ? (
          <NavForm
            categories={categories}
            collections={collections}
            defaultSortOrder={(items.at(-1)?.sortOrder ?? 0) + 10}
            pending={pending}
            onCancel={() => setAdding(false)}
            onSubmit={(d) => run(() => saveNavItemAction(d))}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditing(null);
            }}
            className="rounded-sm border border-border px-3 py-1.5 text-sm text-ink transition-colors hover:border-ink"
          >
            + Προσθήκη στοιχείου
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-ink">Κανένα στοιχείο ακόμα.</p>
          <p className="mt-1 text-xs text-ink-muted">
            Το κατάστημα δείχνει τις κύριες κατηγορίες μέχρι να προσθέσεις.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={item.id} className="rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-3 p-3">
                <span
                  className="rounded-sm px-2 py-1 text-sm font-medium"
                  style={{
                    color: item.textColor ?? undefined,
                    backgroundColor: item.backgroundColor ?? undefined,
                  }}
                >
                  {item.label}
                </span>
                <span className="text-xs text-ink-muted">
                  {DEST_LABELS[item.destinationType]}
                  {item.destinationValue ? ` — ${item.destinationValue}` : ""}
                </span>
                {!item.isActive && (
                  <span className="rounded-sm bg-surface-strong px-1.5 py-0.5 text-[11px] text-ink-muted">
                    Κρυφό
                  </span>
                )}

                <div className="ml-auto flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Μετακίνηση πάνω: ${item.label}`}
                    disabled={pending || i === 0}
                    onClick={() => run(() => moveNavItemAction(item.id, "up"))}
                    className="h-7 w-7 rounded-sm border border-border text-ink disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Μετακίνηση κάτω: ${item.label}`}
                    disabled={pending || i === items.length - 1}
                    onClick={() => run(() => moveNavItemAction(item.id, "down"))}
                    className="h-7 w-7 rounded-sm border border-border text-ink disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setNavItemActiveAction(item.id, !item.isActive))}
                    className="rounded-sm px-2 py-1 text-sm text-ink hover:bg-surface"
                  >
                    {item.isActive ? "Απόκρυψη" : "Εμφάνιση"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(editing === item.id ? null : item.id);
                      setAdding(false);
                    }}
                    className="rounded-sm px-2 py-1 text-sm text-ink hover:bg-surface"
                  >
                    Επεξεργασία
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(item)}
                    className="rounded-sm px-2 py-1 text-sm text-danger hover:bg-danger/5"
                  >
                    Διαγραφή
                  </button>
                </div>
              </div>

              {editing === item.id && (
                <div className="border-t border-border p-3">
                  <NavForm
                    item={item}
                    categories={categories}
                    collections={collections}
                    defaultSortOrder={item.sortOrder}
                    pending={pending}
                    onCancel={() => setEditing(null)}
                    onSubmit={(d) => run(() => saveNavItemAction(d))}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-bg p-5">
            <p className="text-sm text-ink">
              Διαγραφή του στοιχείου {confirmDelete.label} από την πλοήγηση;
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-ink"
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => deleteNavItemAction(confirmDelete.id))}
                className="rounded-md bg-danger px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Διαγραφή
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function NavForm({
  item,
  categories,
  collections,
  defaultSortOrder,
  pending,
  onCancel,
  onSubmit,
}: {
  item?: AdminNavItem;
  categories: NavPickerOption[];
  collections: NavPickerOption[];
  defaultSortOrder: number;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: FormData) => void;
}) {
  const [type, setType] = useState<NavDestinationType>(item?.destinationType ?? "category");
  const [textColor, setTextColor] = useState(item?.textColor ?? "");
  const [bgColor, setBgColor] = useState(item?.backgroundColor ?? "");

  const needsValue = !VALUELESS.includes(type);
  const ratio = HEX.test(textColor) && HEX.test(bgColor) ? contrastRatio(textColor, bgColor) : null;

  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="sortOrder" value={defaultSortOrder} />

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="label">
            Ετικέτα
          </label>
          <input
            id="label"
            name="label"
            required
            defaultValue={item?.label ?? ""}
            placeholder="ΠΡΟΣΦΟΡΕΣ"
            className={field}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="destinationType">
            Τύπος προορισμού
          </label>
          <select
            id="destinationType"
            name="destinationType"
            value={type}
            onChange={(e) => setType(e.target.value as NavDestinationType)}
            className={field}
          >
            {(Object.keys(DEST_LABELS) as NavDestinationType[]).map((t) => (
              <option key={t} value={t}>
                {DEST_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {needsValue ? (
        <div>
          <label className={labelCls} htmlFor="destinationValue">
            Προορισμός
          </label>
          {type === "category" || type === "collection" ? (
            <select
              id="destinationValue"
              name="destinationValue"
              defaultValue={item?.destinationValue ?? ""}
              className={field}
            >
              <option value="">— Διάλεξε —</option>
              {(type === "category" ? categories : collections).map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="destinationValue"
              name="destinationValue"
              defaultValue={item?.destinationValue ?? ""}
              placeholder={type === "product" ? "slug προϊόντος" : "/kouzina ή https://…"}
              className={field}
            />
          )}
        </div>
      ) : (
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-ink-muted">
          Σταθερός προορισμός: {type === "sale" ? "/prosfores" : "/nea-afiksi"}. Η σελίδα
          ενημερώνεται μόνη της από τον κατάλογο.
        </p>
      )}

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-ink-muted">Χρώματα (προαιρετικά)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorInput
            name="textColor"
            label="Χρώμα κειμένου"
            value={textColor}
            onChange={setTextColor}
          />
          <ColorInput
            name="backgroundColor"
            label="Χρώμα φόντου"
            value={bgColor}
            onChange={setBgColor}
          />
        </div>

        {(HEX.test(textColor) || HEX.test(bgColor)) && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-xs text-ink-muted">Προεπισκόπηση:</span>
            <span
              className="rounded-sm px-3 py-1.5 text-sm font-medium"
              style={{
                color: HEX.test(textColor) ? textColor : undefined,
                backgroundColor: HEX.test(bgColor) ? bgColor : undefined,
              }}
            >
              {item?.label || "ΠΡΟΣΦΟΡΕΣ"}
            </span>
            {ratio !== null && (
              <span className={`text-xs ${ratio < 4.5 ? "text-danger" : "text-ink-muted"}`}>
                Αντίθεση {ratio.toFixed(1)}:1{" "}
                {ratio < 4.5 ? "— δυσανάγνωστο, δοκίμασε μεγαλύτερη διαφορά" : "— εντάξει"}
              </span>
            )}
          </div>
        )}

        <p className="mt-2 text-xs text-ink-muted">
          Κενό = κανονική εμφάνιση. Δέχεται μόνο χρώμα, όχι άλλο styling.
        </p>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={item?.isActive ?? true}
          className="h-4 w-4 accent-ink"
        />
        Ορατό στο κατάστημα
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Αποθήκευση
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm text-ink"
        >
          Άκυρο
        </button>
      </div>
    </form>
  );
}

/**
 * A native colour swatch paired with a text field. The swatch cannot express
 * "unset", so the text field stays authoritative — clearing it is how an item
 * returns to the header's default styling.
 */
function ColorInput({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={labelCls} htmlFor={name}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} — επιλογή χρώματος`}
          value={HEX.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 rounded-md border border-border bg-bg"
        />
        <input
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#c0392b"
          className={field}
        />
      </div>
    </div>
  );
}
