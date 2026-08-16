"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteSynonymAction, saveSynonymAction } from "@/lib/admin/settings-actions";
import type { AdminSynonym } from "@/lib/admin/settings";

/**
 * Search synonym groups.
 *
 * A group means "treat any of these as the same query". The storefront's
 * search expands a query to every term in its matching group before ranking,
 * rather than blending synonym hits into the score — so a match stays
 * explainable as "this tier matched" instead of an opaque relevance number.
 */
export function SynonymManager({ synonyms }: { synonyms: AdminSynonym[] }) {
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
          Νέα ομάδα
        </button>
      </div>

      {editing === "new" && (
        <div className="mb-3">
          <SynonymForm pending={pending} onCancel={() => setEditing(null)} onSave={(d) => run(() => saveSynonymAction(d))} />
        </div>
      )}

      {synonyms.length === 0 && editing !== "new" ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink">Δεν υπάρχουν ομάδες συνωνύμων</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Χρήσιμες όταν οι πελάτες ψάχνουν κάτι με διαφορετική λέξη από αυτή που χρησιμοποιείς εσύ —
            π.χ. «τηγάνι, tigani, pan».
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {synonyms.map((s) => (
            <div key={s.id} className="border-b border-border last:border-b-0">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    {s.terms.split(",").map((t) => (
                      <span key={t} className="rounded-sm bg-surface-strong px-2 py-0.5 text-sm text-ink">
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(s.id)}
                  className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface"
                >
                  Επεξεργασία
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => deleteSynonymAction(s.id))}
                  className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-danger/5 hover:text-danger"
                >
                  Διαγραφή
                </button>
              </div>
              {editing === s.id && (
                <div className="border-t border-border bg-surface/40 px-4 py-4">
                  <SynonymForm
                    synonym={s}
                    pending={pending}
                    onCancel={() => setEditing(null)}
                    onSave={(d) => run(() => saveSynonymAction(d))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SynonymForm({
  synonym,
  pending,
  onCancel,
  onSave,
}: {
  synonym?: AdminSynonym;
  pending: boolean;
  onCancel: () => void;
  onSave: (data: FormData) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        if (synonym) data.set("id", synonym.id);
        onSave(data);
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">Όροι (χωρισμένοι με κόμμα)</label>
        <input
          name="terms"
          defaultValue={synonym?.terms ?? ""}
          required
          autoFocus
          placeholder="τηγάνι, tigani, pan"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <p className="text-xs text-ink-muted">
          Χρειάζονται τουλάχιστον δύο όροι. Όποιον κι αν πληκτρολογήσει ο πελάτης, θα βρει τα ίδια
          αποτελέσματα.
        </p>
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
