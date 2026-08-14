"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteHomepageBlockAction, saveHomepageBlockAction } from "@/lib/admin/cms-actions";
import type { AdminHomepageBlock } from "@/lib/admin/cms";

/**
 * Hero slides and promo blocks.
 *
 * Both use the same field set, which is why they share one table and one
 * editor — `kind` is the only thing that differs. Unpublished blocks are kept
 * visible here (greyed) rather than hidden, because "where did my draft go"
 * is a worse problem than a slightly busier list.
 */

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

export function HomepageBlockManager({
  blocks,
  kind,
  title,
  description,
}: {
  blocks: AdminHomepageBlock[];
  kind: "hero" | "promo";
  title: string;
  description: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminHomepageBlock | null>(null);

  const mine = blocks.filter((b) => b.kind === kind);

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
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">{title}</h2>
          <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
        >
          + Νέο
        </button>
      </div>

      {msg && (
        <p role="status" className={`mb-3 text-sm ${msg.ok ? "text-success" : "text-danger"}`}>
          {msg.text}
        </p>
      )}

      {editing === "new" && (
        <div className="mb-3">
          <BlockForm kind={kind} pending={pending} onCancel={() => setEditing(null)} onSave={(d) => run(() => saveHomepageBlockAction(d))} />
        </div>
      )}

      {mine.length === 0 && editing !== "new" ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-ink-muted">
            Δεν έχεις προσθέσει {kind === "hero" ? "διαφάνειες" : "μπλοκ"}. Το κατάστημα δείχνει το
            προεπιλεγμένο περιεχόμενο.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {mine.map((b) => (
            <div key={b.id} className="rounded-lg border border-border">
              <div className={`flex flex-wrap items-center gap-3 px-4 py-3 ${b.isPublished ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">{b.heading || "(χωρίς τίτλο)"}</span>
                    {!b.isPublished && (
                      <span className="rounded-sm bg-surface px-1.5 py-0.5 text-xs text-ink-muted">Πρόχειρο</span>
                    )}
                  </div>
                  {b.eyebrow && <div className="text-xs text-ink-muted">{b.eyebrow}</div>}
                </div>
                <span className="text-xs tabular-nums text-ink-muted">#{b.sortOrder}</span>
                <button
                  type="button"
                  onClick={() => setEditing(b.id)}
                  className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface"
                >
                  Επεξεργασία
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(b)}
                  className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-danger/5 hover:text-danger"
                >
                  Διαγραφή
                </button>
              </div>
              {editing === b.id && (
                <div className="border-t border-border bg-surface/40 px-4 py-4">
                  <BlockForm
                    block={b}
                    kind={kind}
                    pending={pending}
                    onCancel={() => setEditing(null)}
                    onSave={(d) => run(() => saveHomepageBlockAction(d))}
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
            <h2 className="font-display text-lg text-ink">Διαγραφή μπλοκ</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Θα διαγραφεί οριστικά το «{confirmDelete.heading || "χωρίς τίτλο"}».
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-md border border-border px-3.5 py-2 text-sm hover:bg-surface">
                Άκυρο
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => deleteHomepageBlockAction(confirmDelete.id))}
                className="rounded-md bg-danger px-3.5 py-2 text-sm font-medium text-bg hover:bg-danger/90 disabled:opacity-50"
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

function BlockForm({
  block,
  kind,
  pending,
  onCancel,
  onSave,
}: {
  block?: AdminHomepageBlock;
  kind: "hero" | "promo";
  pending: boolean;
  onCancel: () => void;
  onSave: (data: FormData) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set("kind", kind);
        if (block) data.set("id", block.id);
        onSave(data);
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Eyebrow (μικρό κείμενο)</label>
          <input name="eyebrow" defaultValue={block?.eyebrow ?? ""} className={field} placeholder="ΝΕΑ ΣΥΛΛΟΓΗ" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Τίτλος</label>
          <input name="heading" defaultValue={block?.heading ?? ""} className={field} autoFocus />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">Κείμενο</label>
        <textarea name="body" rows={2} defaultValue={block?.body ?? ""} className={field} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Κείμενο κουμπιού</label>
          <input name="ctaLabel" defaultValue={block?.ctaLabel ?? ""} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Σύνδεσμος κουμπιού</label>
          <input name="ctaHref" defaultValue={block?.ctaHref ?? ""} className={field} placeholder="/kouzina" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Εικόνα (διαδρομή)</label>
          <input name="imagePath" defaultValue={block?.imagePath ?? ""} className={field} />
          <p className="text-xs text-ink-muted">Ενεργοποιείται με τη ρύθμιση του Supabase Storage.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Σειρά</label>
          <input name="sortOrder" defaultValue={block?.sortOrder ?? 0} inputMode="numeric" className={field} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="isPublished" defaultChecked={block?.isPublished ?? false} className="h-4 w-4 accent-ink" />
        Δημοσιευμένο
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
