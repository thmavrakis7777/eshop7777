"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, EmptyState, buttonStyles } from "@/components/admin/ui/primitives";
import {
  deleteJournalCategoryAction,
  saveJournalCategoryAction,
} from "@/lib/admin/journal-actions";
import { slugFromGreek } from "@/lib/slug";
import type { AdminJournalCategory } from "@/lib/admin/journal";

/**
 * Journal categories, created and renamed by the owner — nothing here is
 * hardcoded. Κουζίνα, Οργάνωση Σπιτιού, Κήπος and the rest are examples the
 * shop happens to start with, not a fixed enum, which is why the storefront
 * reads them from the database and why every category page is a real route
 * derived from the slug typed here.
 *
 * Deleting a category leaves its articles alone (ON DELETE SET NULL) — the
 * row's article count says how many would become uncategorised, so that is
 * never a surprise.
 */

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

type Draft = { id?: string; name: string; slug: string; description: string; sortOrder: number };

const EMPTY: Draft = { name: "", slug: "", description: "", sortOrder: 0 };

export function JournalCategoryManager({ categories }: { categories: AdminJournalCategory[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const derivedSlug = draft ? (slugTouched || draft.id ? draft.slug : slugFromGreek(draft.name)) : "";

  function open(category?: AdminJournalCategory) {
    setSlugTouched(false);
    setDraft(
      category
        ? {
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description ?? "",
            sortOrder: category.sortOrder,
          }
        : { ...EMPTY, sortOrder: categories.length }
    );
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    const data = new FormData();
    if (draft.id) data.set("id", draft.id);
    data.set("name", draft.name);
    data.set("slug", derivedSlug);
    data.set("description", draft.description);
    data.set("sortOrder", String(draft.sortOrder));
    startTransition(async () => {
      const result = await saveJournalCategoryAction(data);
      setMsg(
        result.ok ? { ok: true, text: result.message ?? "Αποθηκεύτηκε." } : { ok: false, text: result.error }
      );
      if (result.ok) {
        setDraft(null);
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
            msg.ok
              ? "border-success/30 bg-success/5 text-success"
              : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="mb-4">
        <button type="button" onClick={() => open()} className={buttonStyles.primary}>
          Νέα κατηγορία
        </button>
      </div>

      {draft && (
        <form onSubmit={submit} className="mb-6 flex flex-col gap-4 rounded-lg border border-border bg-bg p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="jc-name" className="text-sm font-medium text-ink">
                Όνομα
              </label>
              <input
                id="jc-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
                autoFocus
                placeholder="π.χ. Οδηγοί Αγοράς"
                className={field}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="jc-slug" className="text-sm font-medium text-ink">
                Slug (URL)
              </label>
              <input
                id="jc-slug"
                value={derivedSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setDraft({ ...draft, slug: e.target.value });
                }}
                className={field}
              />
              <p className="text-xs text-ink-muted">/journal/kategoria/{derivedSlug || "…"}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="jc-desc" className="text-sm font-medium text-ink">
              Περιγραφή (προαιρετικά)
            </label>
            <textarea
              id="jc-desc"
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className={field}
            />
            <p className="text-xs text-ink-muted">
              Εμφανίζεται στην κορυφή της σελίδας της κατηγορίας και χρησιμοποιείται ως meta description.
            </p>
          </div>

          <div className="flex max-w-[10rem] flex-col gap-1.5">
            <label htmlFor="jc-order" className="text-sm font-medium text-ink">
              Σειρά
            </label>
            <input
              id="jc-order"
              inputMode="numeric"
              value={draft.sortOrder}
              onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })}
              className={field}
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={buttonStyles.primary}>
              {pending ? "Αποθήκευση…" : "Αποθήκευση"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className={buttonStyles.secondary}>
              Άκυρο
            </button>
          </div>
        </form>
      )}

      {categories.length === 0 ? (
        <EmptyState
          title="Καμία κατηγορία ακόμα"
          description="Οι κατηγορίες οργανώνουν το Journal και δημιουργούν σελίδες που μπορεί να βρει το Google — π.χ. Κουζίνα, Οργάνωση Σπιτιού, Κήπος, Οδηγοί Αγοράς."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{c.name}</span>
                  <Badge>{c.articleCount} άρθρα</Badge>
                </div>
                <div className="text-xs text-ink-muted">/journal/kategoria/{c.slug}</div>
              </div>

              <button type="button" onClick={() => open(c)} className={buttonStyles.secondary}>
                Επεξεργασία
              </button>

              {confirmDelete === c.id ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteJournalCategoryAction(c.id);
                        setMsg(
                          result.ok
                            ? { ok: true, text: result.message ?? "Διαγράφηκε." }
                            : { ok: false, text: result.error }
                        );
                        setConfirmDelete(null);
                        if (result.ok) router.refresh();
                      })
                    }
                    className={buttonStyles.danger}
                  >
                    Ναι, διάγραψε
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(null)} className={buttonStyles.ghost}>
                    Άκυρο
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(c.id)} className={buttonStyles.ghost}>
                  Διαγραφή
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
