"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveCategorySeoAction } from "@/lib/admin/cms-actions";
import type { AdminSeoRow } from "@/lib/admin/cms";
import { CategoryAiSeoGenerator } from "@/components/admin/CategoryAiSeoGenerator";

/**
 * Per-category SEO overrides, edited inline.
 *
 * Every category is listed, not just the ones with overrides, because the
 * question this screen answers is "which of my pages have I customised" —
 * which needs the ones you haven't visible too. Clearing all fields removes
 * the override entirely rather than saving an empty one that would shadow
 * the page's own metadata with nothing.
 *
 * `categories` already arrives in real tree order (same recursive-CTE walk
 * CategoryManager uses) — indenting by `depth` is enough to show the real
 * hierarchy; no second tree gets built here.
 */
const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

export function CategorySeoEditor({ categories }: { categories: AdminSeoRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <>
      {msg && (
        <p role="status" className={`mb-3 text-sm ${msg.ok ? "text-success" : "text-danger"}`}>
          {msg.text}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        {categories.map((c) => {
          const customised = Boolean(c.seoTitle || c.metaDescription);
          return (
            <div key={c.resourceId} className="border-b border-border last:border-b-0">
              <div
                className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface"
                style={{ paddingLeft: `${1 + c.depth * 1.25}rem` }}
              >
                <div className="min-w-0 flex-1">
                  {c.depth > 0 && <span className="mr-1.5 text-ink-muted">{"—".repeat(c.depth)}</span>}
                  <span className="font-medium text-ink">{c.label}</span>
                  {c.robots === "noindex" && (
                    <span className="ml-2 rounded-sm bg-danger/10 px-1.5 py-0.5 text-xs font-medium text-danger">
                      noindex
                    </span>
                  )}
                  <div className="truncate text-xs text-ink-muted">
                    {c.seoTitle || <span className="italic">Χρησιμοποιεί τον προεπιλεγμένο τίτλο</span>}
                  </div>
                </div>
                {customised ? (
                  <span className="rounded-sm bg-surface-strong px-1.5 py-0.5 text-xs text-ink">
                    Προσαρμοσμένο
                  </span>
                ) : (
                  <span className="rounded-sm bg-accent/10 px-1.5 py-0.5 text-xs text-accent">
                    Δεν έχει ρυθμιστεί SEO
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAiOpen(null);
                    setOpen(open === c.resourceId ? null : c.resourceId);
                  }}
                  className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface"
                >
                  {open === c.resourceId ? "Κλείσιμο" : "Επεξεργασία"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(null);
                    setAiOpen(aiOpen === c.resourceId ? null : c.resourceId);
                  }}
                  className="rounded-md border border-accent/40 px-2.5 py-1 text-sm text-accent hover:bg-accent/10"
                >
                  {aiOpen === c.resourceId ? "Κλείσιμο" : "✨ SEO-GEO"}
                </button>
              </div>

              {aiOpen === c.resourceId && (
                <div className="border-t border-border bg-surface/40 px-4 py-4">
                  <CategoryAiSeoGenerator
                    categoryId={c.resourceId}
                    hasExistingContent={Boolean(c.description || c.seoTitle || c.metaDescription)}
                    onDone={() => setAiOpen(null)}
                  />
                </div>
              )}

              {open === c.resourceId && (
                <div className="border-t border-border bg-surface/40 px-4 py-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      startTransition(async () => {
                        const result = await saveCategorySeoAction(c.resourceId, data);
                        setMsg(
                          result.ok
                            ? { ok: true, text: result.message ?? "Αποθηκεύτηκε." }
                            : { ok: false, text: result.error ?? "" }
                        );
                        if (result.ok) router.refresh();
                      });
                    }}
                    className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
                  >
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-ink">Τίτλος</label>
                      <input name="seoTitle" defaultValue={c.seoTitle ?? ""} className={field} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-ink">Meta περιγραφή</label>
                      <textarea name="metaDescription" rows={2} defaultValue={c.metaDescription ?? ""} className={field} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-ink">Ευρετηρίαση</label>
                      <select name="robots" defaultValue={c.robots} className={field}>
                        <option value="index">Να ευρετηριάζεται (index)</option>
                        <option value="noindex">Να ΜΗΝ ευρετηριάζεται (noindex)</option>
                      </select>
                    </div>
                    <p className="text-xs text-ink-muted">
                      Άδειασε και τα δύο πεδία για να επιστρέψει η κατηγορία στον προεπιλεγμένο τίτλο και
                      περιγραφή της.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={pending}
                        className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg hover:bg-ink/90 disabled:opacity-50"
                      >
                        {pending ? "Αποθήκευση…" : "Αποθήκευση"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpen(null)}
                        className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface"
                      >
                        Κλείσιμο
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
