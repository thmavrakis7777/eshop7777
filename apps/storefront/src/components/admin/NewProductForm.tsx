"use client";

import { useState, useTransition } from "react";
import { createProductAction } from "@/lib/admin/catalog-actions";

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

/**
 * Slug and SKU are derived from the title as you type, but stay editable —
 * and stop auto-deriving the moment they are edited by hand, so a deliberate
 * value is never overwritten by a later title tweak.
 */
function slugFromTitle(title: string): string {
  const map: Record<string, string> = {
    α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
    κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
    ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
  };
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function NewProductForm({ categories }: { categories: Array<{ id: string; name: string; depth: number }> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [skuTouched, setSkuTouched] = useState(false);

  const derivedSlug = slugTouched ? slug : slugFromTitle(title);
  const derivedSku = skuTouched ? sku : slugFromTitle(title).toUpperCase();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set("slug", derivedSlug);
        data.set("sku", derivedSku);
        setError(null);
        startTransition(async () => {
          // On success this redirects into the editor and never returns.
          const result = await createProductAction(data);
          if (result && !result.ok) setError(result.error);
        });
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="np-title" className="text-sm font-medium text-ink">
          Τίτλος
        </label>
        <input
          id="np-title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          className={field}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="np-slug" className="text-sm font-medium text-ink">
            Slug (URL)
          </label>
          <input
            id="np-slug"
            value={derivedSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="np-sku" className="text-sm font-medium text-ink">
            Κωδικός (SKU)
          </label>
          <input
            id="np-sku"
            value={derivedSku}
            onChange={(e) => {
              setSkuTouched(true);
              setSku(e.target.value);
            }}
            required
            className={field}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="np-price" className="text-sm font-medium text-ink">
            Τιμή (€)
          </label>
          <input id="np-price" name="price" inputMode="decimal" defaultValue="0,00" required className={field} />
          <p className="text-xs text-ink-muted">Με ΦΠΑ, όπως θα τη δει ο πελάτης.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="np-stock" className="text-sm font-medium text-ink">
            Απόθεμα
          </label>
          <input id="np-stock" name="stock" inputMode="numeric" defaultValue="0" className={field} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="np-category" className="text-sm font-medium text-ink">
          Κατηγορία
        </label>
        <select id="np-category" name="categoryId" className={field} defaultValue="">
          <option value="">— Καμία —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {"— ".repeat(c.depth)}
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <p className="text-xs text-ink-muted">
        Το προϊόν δημιουργείται <strong>ανενεργό</strong> — δεν θα εμφανιστεί στο κατάστημα μέχρι να το
        ενεργοποιήσεις.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-ink/90 disabled:opacity-50"
      >
        {pending ? "Δημιουργία…" : "Δημιουργία προϊόντος"}
      </button>
    </form>
  );
}
