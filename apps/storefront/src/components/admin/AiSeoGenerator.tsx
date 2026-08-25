"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  generateSeoContentAction,
  regenerateFieldAction,
  saveAiSeoContentAction,
} from "@/lib/admin/ai-seo-actions";
import type { SeoField, SeoGenerationResult } from "@/lib/ai";

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";
const labelCls = "text-sm font-medium text-ink";
const hint = "text-xs text-ink-muted";

const FIELD_LABELS: Record<SeoField, string> = {
  description: "Περιγραφή",
  seoTitle: "SEO Τίτλος",
  metaDescription: "Meta περιγραφή",
  h1: "H1 (ενημερώνει και τον τίτλο του προϊόντος)",
  slug: "SEO Slug",
  imageAlt: "Alt κειμένου κύριας εικόνας",
};

const FIELD_ORDER: SeoField[] = ["description", "seoTitle", "metaDescription", "h1", "slug", "imageAlt"];

export function AiSeoGenerator({
  productId,
  hasExistingContent,
  isPublished,
  hasPrimaryImage,
}: {
  productId: string;
  hasExistingContent: boolean;
  isPublished: boolean;
  hasPrimaryImage: boolean;
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
      const result = await generateSeoContentAction(productId, notes);
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

  function regenerateOne(fieldName: SeoField) {
    if (!generated) return;
    setFeedback(null);
    setRegenerating(fieldName);
    startTransition(async () => {
      const result = await regenerateFieldAction(productId, fieldName, notes);
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
      const result = await saveAiSeoContentAction(productId, generated);
      if (!result.ok) {
        setFeedback({ ok: false, text: result.error });
        return;
      }
      setFeedback({ ok: true, text: "Το περιεχόμενο AI αποθηκεύτηκε." });
      setGenerated(null);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-accent/30 bg-accent/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">✨ AI SEO + GEO</h2>
          <p className={`mt-1 ${hint}`}>
            Δημιουργεί περιγραφή, SEO τίτλο, meta περιγραφή, H1, slug και alt εικόνας από τα πραγματικά
            στοιχεία του προϊόντος. Καλείται μόνο όταν το ζητήσεις — ποτέ αυτόματα.
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
          <label htmlFor="ai-notes" className={labelCls}>
            Σημειώσεις (προαιρετικό)
          </label>
          <textarea
            id="ai-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="π.χ. αντικολλητικό τηγάνι για καθημερινή χρήση"
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
                <label htmlFor={`ai-${f}`} className={labelCls}>
                  {FIELD_LABELS[f]}
                </label>
                <button
                  type="button"
                  onClick={() => regenerateOne(f)}
                  disabled={pending || (f === "imageAlt" && !hasPrimaryImage)}
                  className="shrink-0 text-xs text-ink-muted underline hover:text-ink disabled:opacity-40"
                >
                  {regenerating === f ? "Αναδημιουργία…" : "↻ Αναδημιουργία"}
                </button>
              </div>
              {f === "description" ? (
                <textarea
                  id={`ai-${f}`}
                  rows={4}
                  value={generated[f]}
                  onChange={(e) => setGenerated({ ...generated, [f]: e.target.value })}
                  className={field}
                />
              ) : (
                <input
                  id={`ai-${f}`}
                  value={generated[f]}
                  onChange={(e) => setGenerated({ ...generated, [f]: e.target.value })}
                  className={field}
                />
              )}
              {f === "slug" && isPublished && (
                <p className="text-xs text-danger">
                  Το προϊόν είναι ήδη δημοσιευμένο — η αλλαγή του slug θα αλλάξει το δημόσιο URL του.
                </p>
              )}
              {f === "imageAlt" && !hasPrimaryImage && (
                <p className={hint}>Το προϊόν δεν έχει ακόμα εικόνα — αυτό το πεδίο δεν θα αποθηκευτεί.</p>
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
            aria-labelledby="ai-replace-title"
            className="relative w-full max-w-md rounded-lg border border-border bg-bg p-6"
          >
            <h2 id="ai-replace-title" className="font-display text-lg text-ink">
              Εντοπίστηκε υπάρχον περιεχόμενο SEO
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Αυτό το προϊόν έχει ήδη χειρόγραφη περιγραφή ή/και SEO στοιχεία. Η δημιουργία με AI δεν θα
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
