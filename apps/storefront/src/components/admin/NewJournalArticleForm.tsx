"use client";

import { useState, useTransition } from "react";
import { createJournalArticleAction } from "@/lib/admin/journal-actions";
import { slugFromGreek } from "@/lib/slug";

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

/**
 * Title and slug, nothing else — the article is created as a draft and the
 * action redirects straight into the editor. Same reasoning as
 * NewProductForm: a long form standing between the owner and a blank page is
 * how articles stop getting written.
 *
 * The slug derives from the title as you type but stops the moment it is
 * edited by hand, so a deliberate value is never overwritten by a later
 * title tweak.
 */
export function NewJournalArticleForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const derivedSlug = slugTouched ? slug : slugFromGreek(title);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set("slug", derivedSlug);
        setError(null);
        startTransition(async () => {
          // On success this redirects into the editor and never returns.
          const result = await createJournalArticleAction(data);
          if (result && !result.ok) setError(result.error);
        });
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nj-title" className="text-sm font-medium text-ink">
          Τίτλος άρθρου
        </label>
        <input
          id="nj-title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          placeholder="π.χ. Πώς να διαλέξετε τηγάνι"
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nj-slug" className="text-sm font-medium text-ink">
          Slug (URL)
        </label>
        <input
          id="nj-slug"
          value={derivedSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className={field}
        />
        <p className="text-xs text-ink-muted">
          Η διεύθυνση θα είναι <code>/journal/{derivedSlug || "…"}</code>
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <p className="text-xs text-ink-muted">
        Το άρθρο δημιουργείται ως <strong>πρόχειρο</strong> — δεν εμφανίζεται πουθενά στο κατάστημα
        μέχρι να το δημοσιεύσεις.
      </p>

      <button type="submit" disabled={pending} className="self-start rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-ink/90 disabled:opacity-50">
        {pending ? "Δημιουργία…" : "Δημιουργία άρθρου"}
      </button>
    </form>
  );
}
