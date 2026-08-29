"use client";

import { useState } from "react";
import type { AdminSeoRow } from "@/lib/admin/cms";
import { CategoryAiSeoGenerator } from "@/components/admin/CategoryAiSeoGenerator";
import { CategoryManualSeoEditor } from "@/components/admin/CategoryManualSeoEditor";

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
 *
 * "Επεξεργασία" (manual, CategoryManualSeoEditor) and "✨ SEO-GEO"
 * (AI-assisted, CategoryAiSeoGenerator) are two doors onto the exact same
 * data — description/seoTitle/metaDescription can be set or edited by
 * either one, so nothing an AI generation writes is ever locked from manual
 * editing afterward, and nothing manually typed is off-limits to AI
 * regeneration (which asks before replacing anything).
 */
export function CategorySeoEditor({ categories }: { categories: AdminSeoRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {categories.map((c) => {
          const customised = Boolean(c.seoTitle || c.metaDescription || c.keywords || c.ogTitle || c.ogDescription);
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
                  <CategoryManualSeoEditor category={c} onSaved={() => setOpen(null)} onClose={() => setOpen(null)} />
                </div>
              )}
            </div>
          );
      })}
    </div>
  );
}
