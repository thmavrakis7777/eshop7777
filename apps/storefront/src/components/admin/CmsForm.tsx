"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * The shared shape of every CMS editing form: fields, a save button, a dirty
 * indicator and inline feedback. Built once so five screens behave
 * identically rather than each inventing its own save semantics.
 */

export type FieldDef =
  | { name: string; label: string; type: "text" | "email" | "tel" | "url" | "date" | "number"; hint?: string; placeholder?: string }
  | { name: string; label: string; type: "textarea"; rows?: number; hint?: string; placeholder?: string }
  | { name: string; label: string; type: "checkbox"; hint?: string }
  | { name: string; label: string; type: "select"; options: Array<{ value: string; label: string }>; hint?: string };

export type FieldValues = Record<string, string | number | boolean | null | undefined>;

const inputCls =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

export function CmsForm({
  fields,
  values,
  action,
  submitLabel = "Αποθήκευση",
  hiddenValues,
  columns = 1,
  children,
}: {
  fields: FieldDef[];
  values: FieldValues;
  action: (data: FormData) => Promise<{ ok: boolean; message?: string; error?: string }>;
  submitLabel?: string;
  hiddenValues?: Record<string, string>;
  columns?: 1 | 2;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      onChange={() => setDirty(true)}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        for (const [k, v] of Object.entries(hiddenValues ?? {})) data.set(k, v);
        startTransition(async () => {
          const result = await action(data);
          setMsg(result.ok ? { ok: true, text: result.message ?? "Αποθηκεύτηκε." } : { ok: false, text: result.error ?? "" });
          if (result.ok) {
            setDirty(false);
            router.refresh();
          }
        });
      }}
      className="flex flex-col gap-4"
    >
      {msg && (
        <div
          role="status"
          className={`rounded-md border px-4 py-2.5 text-sm ${
            msg.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className={columns === 2 ? "grid gap-4 sm:grid-cols-2" : "flex flex-col gap-4"}>
        {fields.map((f) => {
          const id = `cms-${f.name}`;
          const raw = values[f.name];

          if (f.type === "checkbox") {
            return (
              <div key={f.name} className={columns === 2 ? "sm:col-span-2" : ""}>
                <label className="flex items-center gap-2.5 text-sm text-ink">
                  <input type="checkbox" name={f.name} defaultChecked={Boolean(raw)} className="h-4 w-4 accent-ink" />
                  {f.label}
                </label>
                {f.hint && <p className="mt-1 pl-6.5 text-xs text-ink-muted">{f.hint}</p>}
              </div>
            );
          }

          return (
            <div key={f.name} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="text-sm font-medium text-ink">
                {f.label}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  id={id}
                  name={f.name}
                  rows={f.rows ?? 3}
                  defaultValue={(raw as string) ?? ""}
                  placeholder={f.placeholder}
                  className={inputCls}
                />
              ) : f.type === "select" ? (
                <select id={id} name={f.name} defaultValue={(raw as string) ?? ""} className={inputCls}>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  name={f.name}
                  type={f.type === "number" ? "text" : f.type}
                  inputMode={f.type === "number" ? "decimal" : undefined}
                  defaultValue={(raw as string) ?? ""}
                  placeholder={f.placeholder}
                  className={inputCls}
                />
              )}
              {f.hint && <p className="text-xs text-ink-muted">{f.hint}</p>}
            </div>
          );
        })}
      </div>

      {children}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Αποθήκευση…" : submitLabel}
        </button>
        <span className="text-xs text-ink-muted">
          {dirty ? "Μη αποθηκευμένες αλλαγές" : "Όλες οι αλλαγές αποθηκεύτηκαν"}
        </span>
      </div>
    </form>
  );
}
