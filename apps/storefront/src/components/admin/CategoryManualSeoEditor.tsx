"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveCategorySeoAction } from "@/lib/admin/cms-actions";
import type { AdminSeoRow } from "@/lib/admin/cms";

/**
 * Full manual control over every SEO-GEO field a category has — whether it
 * was hand-typed or written earlier by the "SEO-GEO" AI button
 * (CategoryAiSeoGenerator.tsx). Both write the exact same
 * shop.category.description / shop.seo_meta columns via the same
 * saveCategorySeoAction, so nothing here is "AI-owned": this editor works
 * with zero AI involvement, and re-running AI later can still touch
 * whatever gets saved here.
 *
 * One `useState` per counted field, reset fresh on every mount — this
 * component only ever mounts while its own category's panel is open
 * (CategorySeoEditor gates it on `open === c.resourceId`), so there is no
 * cross-category state to leak between rows.
 */

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";
const labelCls = "text-sm font-medium text-ink";
const counterCls = "shrink-0 text-xs text-ink-muted";

const SEO_TITLE_GUIDE = 60;
const META_DESCRIPTION_GUIDE = 160;

export function CategoryManualSeoEditor({
  category,
  onSaved,
  onClose,
}: {
  category: AdminSeoRow;
  onSaved: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [seoTitle, setSeoTitle] = useState(category.seoTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(category.metaDescription ?? "");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setFeedback(null);
        // Native FormData still reflects these controlled inputs' current
        // DOM value — the counters above don't need a second source of truth.
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await saveCategorySeoAction(category.resourceId, data);
          if (!result.ok) {
            setFeedback({ ok: false, text: result.error ?? "Κάτι πήγε στραβά. Δοκίμασε ξανά." });
            return;
          }
          setFeedback({ ok: true, text: result.message ?? "Αποθηκεύτηκε." });
          router.refresh();
          onSaved();
        });
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`seoTitle-${category.resourceId}`} className={labelCls}>
            SEO Τίτλος
          </label>
          <span className={counterCls}>
            {seoTitle.length} / {SEO_TITLE_GUIDE} χαρακτήρες
          </span>
        </div>
        <input
          id={`seoTitle-${category.resourceId}`}
          name="seoTitle"
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`metaDescription-${category.resourceId}`} className={labelCls}>
            Meta περιγραφή
          </label>
          <span className={counterCls}>
            {metaDescription.length} / {META_DESCRIPTION_GUIDE} χαρακτήρες
          </span>
        </div>
        <textarea
          id={`metaDescription-${category.resourceId}`}
          name="metaDescription"
          rows={2}
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`keywords-${category.resourceId}`} className={labelCls}>
          Λέξεις-κλειδιά
        </label>
        <input
          id={`keywords-${category.resourceId}`}
          name="keywords"
          defaultValue={category.keywords ?? ""}
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`description-${category.resourceId}`} className={labelCls}>
          Περιγραφή κατηγορίας
        </label>
        <textarea
          id={`description-${category.resourceId}`}
          name="description"
          rows={4}
          defaultValue={category.description ?? ""}
          className={field}
        />
        <p className="text-xs text-ink-muted">Το κείμενο που βλέπει ο πελάτης στη σελίδα της κατηγορίας.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`ogTitle-${category.resourceId}`} className={labelCls}>
            Τίτλος για social (Open Graph)
          </label>
          <input
            id={`ogTitle-${category.resourceId}`}
            name="ogTitle"
            defaultValue={category.ogTitle ?? ""}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`ogDescription-${category.resourceId}`} className={labelCls}>
            Περιγραφή για social
          </label>
          <textarea
            id={`ogDescription-${category.resourceId}`}
            name="ogDescription"
            rows={2}
            defaultValue={category.ogDescription ?? ""}
            className={field}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`robots-${category.resourceId}`} className={labelCls}>
          Ευρετηρίαση
        </label>
        <select id={`robots-${category.resourceId}`} name="robots" defaultValue={category.robots} className={field}>
          <option value="index">Να ευρετηριάζεται (index)</option>
          <option value="noindex">Να ΜΗΝ ευρετηριάζεται (noindex)</option>
        </select>
      </div>

      <p className="text-xs text-ink-muted">
        Οι μετρητές χαρακτήρων είναι καθοδήγηση, όχι όριο — η αποθήκευση δεν μπλοκάρεται αν τους ξεπεράσεις.
        Άδειασε τίτλο, meta περιγραφή, λέξεις-κλειδιά ή τα social πεδία για να επιστρέψουν στα προεπιλεγμένα.
      </p>

      {feedback && (
        <p role="status" className={`text-sm ${feedback.ok ? "text-success" : "text-danger"}`}>
          {feedback.text}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Αποθήκευση…" : "Αποθήκευση αλλαγών SEO"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface"
        >
          Κλείσιμο
        </button>
      </div>
    </form>
  );
}
