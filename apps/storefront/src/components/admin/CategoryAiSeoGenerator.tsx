"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  generateCategorySeoContentAction,
  regenerateCategoryFieldAction,
  saveCategoryAiSeoContentAction,
} from "@/lib/admin/ai-category-seo-actions";
import type { SeoField, SeoGenerationResult } from "@/lib/ai";

/**
 * The category SEO Management screen's "SEO-GEO" button.
 *
 * Sibling of AiSeoGenerator.tsx (products), not a variant of it — same UX
 * shape (notes → generate → per-field editable/regenerate → save), same
 * underlying Gemini call via ai-category-seo-actions.ts, but scoped to the
 * 3 fields that actually exist for a category (no SKU/slug/image-alt
 * concept here). Kept as its own file/component rather than adding a
 * `mode` prop to AiSeoGenerator — that component's props (`productId`,
 * `hasPrimaryImage`) don't generalise to a category, and the product
 * SEO-GEO flow must not change shape to accommodate this.
 */

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";
const labelCls = "text-sm font-medium text-ink";
const hint = "text-xs text-ink-muted";

const FIELD_LABELS: Record<"description" | "seoTitle" | "metaDescription", string> = {
  description: "Περιγραφή κατηγορίας",
  seoTitle: "SEO Τίτλος",
  metaDescription: "Meta περιγραφή",
};

const FIELD_ORDER: Array<"description" | "seoTitle" | "metaDescription"> = [
  "description",
  "seoTitle",
  "metaDescription",
];

export function CategoryAiSeoGenerator({
  categoryId,
  hasExistingContent,
  onDone,
}: {
  categoryId: string;
  hasExistingContent: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [generated, setGenerated] = useState<SeoGenerationResult | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [regenerating, setRegenerating] = useState<SeoField | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [savePending, startSave] = useTransition();

  function runGenerate() {
    setFeedback(null);
    startTransition(async () => {
      const result = await generateCategorySeoContentAction(categoryId, notes);
      if (!result.ok) {
        setFeedback({ ok: false, text: result.error });
        return;
      }
      setGenerated(result.content);
    });
  }

  function handleGenerateClick() {
    if (hasExistingContent && !generated) {
      setConfirmReplace(true);
      return;
    }
    runGenerate();
  }

  function regenerateOne(fieldName: "description" | "seoTitle" | "metaDescription") {
    if (!generated) return;
    setFeedback(null);
    setRegenerating(fieldName);
    startTransition(async () => {
      const result = await regenerateCategoryFieldAction(categoryId, fieldName, notes);
      setRegenerating(null);
      if (!result.ok) {
        setFeedback({ ok: false, text: result.error });
        return;
      }
      setGenerated((current) => (current ? { ...current, [fieldName]: result.value } : current));
    });
  }

  function handleSave() {
    if (!generated) return;
    setFeedback(null);
    startSave(async () => {
      const result = await saveCategoryAiSeoContentAction(categoryId, {
        description: generated.description,
        seoTitle: generated.seoTitle,
        metaDescription: generated.metaDescription,
      });
      if (!result.ok) {
        setFeedback({ ok: false, text: result.error });
        return;
      }
      setFeedback({ ok: true, text: "Το περιεχόμενο AI αποθηκεύτηκε." });
      setGenerated(null);
      router.refresh();
      onDone();
    });
  }

  return (
    <section className="rounded-lg border border-accent/30 bg-accent/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">✨ AI SEO + GEO</h2>
          <p className={`mt-1 ${hint}`}>
            Δημιουργεί περιγραφή κατηγορίας, SEO τίτλο και meta περιγραφή από τη θέση της κατηγορίας στο
            μενού. Καλείται μόνο όταν το ζητήσεις — ποτέ αυτόματα.
          </p>
        </div>
        {!generated && (
          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={pending}
            className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {pending ? "Δημιουργία…" : "✨ Δημιουργία SEO + GEO"}
          </button>
        )}
      </div>

      {!generated && (
        <div className="mt-3 flex flex-col gap-1.5">
          <label htmlFor={`ai-cat-notes-${categoryId}`} className={labelCls}>
            Σημειώσεις (προαιρετικό)
          </label>
          <textarea
            id={`ai-cat-notes-${categoryId}`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="π.χ. εστίαση σε αντικολλητικά και μαντεμένια σκεύη"
            className={field}
          />
          <p className={hint}>Πλαίσιο για το AI — όχι το τελικό κείμενο, δεν αντιγράφεται αυτούσιο.</p>
        </div>
      )}

      {feedback && (
        <p role="status" className={`mt-3 text-sm ${feedback.ok ? "text-success" : "text-danger"}`}>
          {feedback.text}
        </p>
      )}

      {generated && (
        <div className="mt-4 flex flex-col gap-4">
          {FIELD_ORDER.map((f) => (
            <div key={f} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`ai-cat-${f}-${categoryId}`} className={labelCls}>
                  {FIELD_LABELS[f]}
                </label>
                <button
                  type="button"
                  onClick={() => regenerateOne(f)}
                  disabled={pending}
                  className="shrink-0 text-xs text-ink-muted underline hover:text-ink disabled:opacity-40"
                >
                  {regenerating === f ? "Αναδημιουργία…" : "↻ Αναδημιουργία"}
                </button>
              </div>
              {f === "description" ? (
                <textarea
                  id={`ai-cat-${f}-${categoryId}`}
                  rows={4}
                  value={generated[f]}
                  onChange={(e) => setGenerated({ ...generated, [f]: e.target.value })}
                  className={field}
                />
              ) : (
                <input
                  id={`ai-cat-${f}-${categoryId}`}
                  value={generated[f]}
                  onChange={(e) => setGenerated({ ...generated, [f]: e.target.value })}
                  className={field}
                />
              )}
            </div>
          ))}

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={savePending}
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-ink/90 disabled:opacity-50"
            >
              {savePending ? "Αποθήκευση…" : "Αποθήκευση"}
            </button>
            <button
              type="button"
              onClick={() => {
                setGenerated(null);
                setFeedback(null);
              }}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface"
            >
              Άκυρο
            </button>
          </div>
        </div>
      )}

      {confirmReplace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <button
            type="button"
            aria-label="Άκυρο"
            onClick={() => setConfirmReplace(false)}
            className="absolute inset-0 bg-ink/30"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`ai-cat-replace-title-${categoryId}`}
            className="relative w-full max-w-md rounded-lg border border-border bg-bg p-6"
          >
            <h2 id={`ai-cat-replace-title-${categoryId}`} className="font-display text-lg text-ink">
              Εντοπίστηκε υπάρχον περιεχόμενο SEO
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Αυτή η κατηγορία έχει ήδη χειρόγραφη περιγραφή ή/και SEO στοιχεία. Η δημιουργία με AI δεν θα
              αποθηκευτεί αυτόματα — θα δεις το προτεινόμενο περιεχόμενο πρώτα και μπορείς να το
              απορρίψεις.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReplace(false)}
                className="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface"
              >
                Διατήρηση υπάρχοντος
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReplace(false);
                  runGenerate();
                }}
                className="rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                Συνέχεια με AI
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
