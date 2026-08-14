"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCollectionAction, saveCollectionAction } from "@/lib/admin/taxonomy-actions";
import type { AdminCollection } from "@/lib/admin/taxonomy";

/**
 * Collections: a flat, curated grouping that can cut across the category
 * tree. Membership is edited from the product editor (a product can belong to
 * several), so this screen owns the collections themselves, not their contents.
 */

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

function slugFromTitle(title: string): string {
  const map: Record<string, string> = {
    α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
    κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
    ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
  };
  return title
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .split("").map((c) => map[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function CollectionManager({ collections }: { collections: AdminCollection[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminCollection | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        if (result.message) setMsg({ ok: true, text: result.message });
        setEditing(null);
        setConfirmDelete(null);
        router.refresh();
      } else {
        setMsg({ ok: false, text: result.error ?? "Κάτι πήγε στραβά." });
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
          Νέα συλλογή
        </button>
      </div>

      {editing === "new" && (
        <div className="mb-4">
          <CollectionForm
            pending={pending}
            onCancel={() => setEditing(null)}
            onSave={(data) => run(() => saveCollectionAction(data))}
          />
        </div>
      )}

      {collections.length === 0 && editing !== "new" ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium text-ink">Δεν υπάρχουν συλλογές ακόμα</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
            Οι συλλογές ομαδοποιούν προϊόντα από διαφορετικές κατηγορίες — π.χ. «Δώρα για το σπίτι» ή
            «Καλοκαιρινές προσφορές».
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {collections.map((c) => (
            <div key={c.id} className="border-b border-border last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-surface">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{c.title}</span>
                    {!c.isActive && (
                      <span className="rounded-sm bg-surface px-1.5 py-0.5 text-xs text-ink-muted">Ανενεργή</span>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted">/syllogi/{c.slug}</div>
                </div>
                <Link
                  href={`/admin/products?collection=${c.id}`}
                  className="text-sm tabular-nums text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  {c.productCount} {c.productCount === 1 ? "προϊόν" : "προϊόντα"}
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(c.id)}
                    className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface"
                  >
                    Επεξεργασία
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(c)}
                    className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-danger/5 hover:text-danger"
                  >
                    Διαγραφή
                  </button>
                </div>
              </div>
              {editing === c.id && (
                <div className="border-t border-border bg-surface/40 px-4 py-4">
                  <CollectionForm
                    collection={c}
                    pending={pending}
                    onCancel={() => setEditing(null)}
                    onSave={(data) => run(() => saveCollectionAction(data))}
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
            <h2 className="font-display text-lg text-ink">Διαγραφή συλλογής</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Θα διαγραφεί η συλλογή <strong className="text-ink">{confirmDelete.title}</strong>.
              {/* Worth stating plainly: unlike a category, this is safe. */}
              {confirmDelete.productCount > 0
                ? ` Τα ${confirmDelete.productCount} προϊόντα της δεν διαγράφονται — απλώς παύουν να ανήκουν σε αυτήν.`
                : ""}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-md border border-border px-3.5 py-2 text-sm font-medium hover:bg-surface"
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => deleteCollectionAction(confirmDelete.id))}
                className="rounded-md bg-danger px-3.5 py-2 text-sm font-medium text-bg hover:bg-danger/90 disabled:opacity-50"
              >
                Διαγραφή
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CollectionForm({
  collection,
  pending,
  onCancel,
  onSave,
}: {
  collection?: AdminCollection;
  pending: boolean;
  onCancel: () => void;
  onSave: (data: FormData) => void;
}) {
  const [title, setTitle] = useState(collection?.title ?? "");
  const [slug, setSlug] = useState(collection?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(collection));
  const derivedSlug = slugTouched ? slug : slugFromTitle(title);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set("slug", derivedSlug);
        if (collection) data.set("id", collection.id);
        onSave(data);
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Τίτλος</label>
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Slug (URL)</label>
          <input
            value={derivedSlug}
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
            required
            className={field}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">Περιγραφή</label>
        <textarea name="description" rows={2} defaultValue={collection?.description ?? ""} className={field} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Σειρά</label>
          <input name="sortOrder" defaultValue={collection?.sortOrder ?? 0} inputMode="numeric" className={field} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm text-ink">
          <input type="checkbox" name="isActive" defaultChecked={collection?.isActive ?? true} className="h-4 w-4 accent-ink" />
          Ενεργή στο κατάστημα
        </label>
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
