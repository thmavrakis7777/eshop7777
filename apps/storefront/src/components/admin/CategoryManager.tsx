"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteCategoryAction,
  moveCategoryAction,
  saveCategoryAction,
} from "@/lib/admin/taxonomy-actions";
import type { AdminCategory } from "@/lib/admin/taxonomy";
import { MAX_CATEGORY_DEPTH } from "@/lib/category-depth";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

/**
 * The category tree, edited in place.
 *
 * Indentation shows nesting; reordering is up/down within a level rather than
 * drag-and-drop, which is fiddly on a touch device and needs a whole
 * interaction layer to be accessible. Two buttons work everywhere.
 */

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

function slugFromName(name: string): string {
  const map: Record<string, string> = {
    α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
    κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
    ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
  };
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .split("").map((c) => map[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminCategory | null>(null);

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
          Νέα κατηγορία
        </button>
      </div>

      {editing === "new" && (
        <CategoryForm
          categories={categories}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={(data) => run(() => saveCategoryAction(data))}
        />
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        {categories.map((c, index) => {
          // Siblings stopped being adjacent rows once categories nest three
          // deep: the flat list puts a subcategory's whole subtree between it
          // and its next sibling, so checking only the neighbouring row
          // disabled both arrows on every parent that had children. Look for
          // a sibling anywhere before/after instead — which is also exactly
          // what the tree glyph below needs to know.
          const canUp = categories.slice(0, index).some((o) => o.parentId === c.parentId);
          const canDown = categories.slice(index + 1).some((o) => o.parentId === c.parentId);

          return (
            <div key={c.id} className="border-b border-border last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-surface">
                <div className="min-w-0 flex-1" style={{ paddingLeft: `${c.depth * 1.5}rem` }}>
                  <div className="flex items-center gap-2">
                    {/* ├ while more siblings follow, └ on the last one — the
                        same shape a file tree uses, so parent/child/grandchild
                        reads at a glance instead of from indentation alone. */}
                    {c.depth > 0 && (
                      <span aria-hidden="true" className="font-mono text-sm text-ink-muted">
                        {canDown ? "├──" : "└──"}
                      </span>
                    )}
                    <span className={c.depth === 0 ? "font-medium text-ink" : "text-ink"}>{c.name}</span>
                    {!c.isActive && (
                      <span className="rounded-sm bg-surface px-1.5 py-0.5 text-xs text-ink-muted">Ανενεργή</span>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted">/{c.slug}</div>
                </div>

                <span className="text-sm tabular-nums text-ink-muted">
                  {c.productCount} {c.productCount === 1 ? "προϊόν" : "προϊόντα"}
                </span>

                <div className="flex items-center gap-1">
                  <IconButton
                    label="Μετακίνηση πάνω"
                    disabled={!canUp || pending}
                    onClick={() => run(() => moveCategoryAction(c.id, "up"))}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    label="Μετακίνηση κάτω"
                    disabled={!canDown || pending}
                    onClick={() => run(() => moveCategoryAction(c.id, "down"))}
                  >
                    ↓
                  </IconButton>
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
                    disabled={pending}
                    className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-danger/5 hover:text-danger"
                  >
                    Διαγραφή
                  </button>
                </div>
              </div>

              {editing === c.id && (
                <div className="border-t border-border bg-surface/40 px-4 py-4">
                  <CategoryForm
                    category={c}
                    categories={categories}
                    pending={pending}
                    onCancel={() => setEditing(null)}
                    onSave={(data) => run(() => saveCategoryAction(data))}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <button
            type="button"
            aria-label="Άκυρο"
            onClick={() => setConfirmDelete(null)}
            className="absolute inset-0 bg-ink/30"
          />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-lg border border-border bg-bg p-6">
            <h2 className="font-display text-lg text-ink">Διαγραφή κατηγορίας</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Θα διαγραφεί η κατηγορία <strong className="text-ink">{confirmDelete.name}</strong>.
              {confirmDelete.childCount > 0 && " Έχει υποκατηγορίες — η διαγραφή θα απορριφθεί."}
              {confirmDelete.productCount > 0 &&
                ` Έχει ${confirmDelete.productCount} προϊόντα — η διαγραφή θα απορριφθεί.`}
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
                onClick={() => run(() => deleteCategoryAction(confirmDelete.id))}
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

function IconButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-border px-2 py-1 text-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function CategoryForm({
  category,
  categories,
  pending,
  onCancel,
  onSave,
}: {
  category?: AdminCategory;
  categories: AdminCategory[];
  pending: boolean;
  onCancel: () => void;
  onSave: (data: FormData) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const derivedSlug = slugTouched ? slug : slugFromName(name);
  const [pageType, setPageType] = useState<"products" | "landing">(category?.pageType ?? "products");
  const faq = category?.faq ?? [];

  // A category cannot be its own parent, nor a descendant's child. The
  // server enforces this too; excluding them here just avoids offering a
  // choice that will be rejected.
  //
  // `subtreeHeight` is how many levels hang below this category, which is
  // what decides how shallow its new parent has to be: moving a branch
  // carries its children along, so a category with grandchildren of its own
  // can only ever become a top-level category.
  const descendantIds = new Set<string>();
  let subtreeHeight = 0;
  if (category) {
    descendantIds.add(category.id);
    let collecting = false;
    for (const c of categories) {
      if (c.id === category.id) { collecting = true; continue; }
      if (collecting) {
        if (c.depth > category.depth) {
          descendantIds.add(c.id);
          subtreeHeight = Math.max(subtreeHeight, c.depth - category.depth);
        } else break;
      }
    }
  }

  const parentOptions = categories.filter(
    (c) => !descendantIds.has(c.id) && c.depth + 1 + subtreeHeight <= MAX_CATEGORY_DEPTH
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set("slug", derivedSlug);
        if (category) data.set("id", category.id);
        onSave(data);
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Όνομα</label>
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className={field} />
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
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Γονική κατηγορία</label>
          <select name="parentId" defaultValue={category?.parentId ?? ""} className={field}>
            <option value="">— Καμία (κύρια κατηγορία) —</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {/* Non-breaking spaces: a <select> collapses ordinary
                    leading whitespace, so this is the only indentation an
                    option can actually keep. */}
                {"   ".repeat(c.depth)}
                {c.depth > 0 ? "└ " : ""}
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-muted">
            Μέχρι τρία επίπεδα: κύρια κατηγορία → υποκατηγορία → υπο-υποκατηγορία.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Σειρά</label>
          <input
            name="sortOrder"
            defaultValue={category?.sortOrder ?? 0}
            inputMode="numeric"
            className={field}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">Περιγραφή</label>
        <textarea name="description" rows={2} defaultValue={category?.description ?? ""} className={field} />
        <p className="text-xs text-ink-muted">
          Εμφανίζεται κάτω από τον τίτλο στη σελίδα της κατηγορίας. Άφησέ το κενό αν δεν έχεις κάτι
          ουσιαστικό να πεις — καλύτερα τίποτα παρά γενικόλογο κείμενο.
        </p>
      </div>

      {/* Every category, not just a landing page: the image is what the
          "Αγόρασε ανά κατηγορία" cards on the storefront show, so the owner
          needs it on an ordinary product category above all. */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">Εικόνα (προαιρετικό)</label>
        <ImageUploadField name="imagePath" defaultValue={category?.imagePath} folder="categories" />
        <p className="text-xs text-ink-muted">
          Ανέβασε αρχείο ή επικόλλησε URL. Χρησιμοποιείται στις κάρτες επιλογής κατηγορίας. Κενό = εμφανίζεται
          το αρχικό γράμμα της κατηγορίας.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">Τύπος σελίδας</label>
        <select
          name="pageType"
          value={pageType}
          onChange={(e) => setPageType(e.target.value as "products" | "landing")}
          className={field}
        >
          <option value="products">Λίστα προϊόντων</option>
          <option value="landing">Σελίδα υπηρεσίας (κείμενο, FAQ — χωρίς λίστα προϊόντων)</option>
        </select>
        <p className="text-xs text-ink-muted">
          Χρησιμοποίησε «Σελίδα υπηρεσίας» για μια κατηγορία που δεν πουλάει προϊόντα απευθείας (π.χ. μια
          τοπική υπηρεσία) — η Περιγραφή γίνεται το εισαγωγικό κείμενο της σελίδας.
        </p>
      </div>

      {pageType === "landing" && (
        <div className="flex flex-col gap-3 rounded-md border border-border p-4">
          <div>
            <p className="text-sm font-medium text-ink">Συχνές Ερωτήσεις (FAQ)</p>
            <p className="text-xs text-ink-muted">
              Μέχρι 5 ερωτήσεις. Άφησε μια ερώτηση ή απάντηση κενή για να μην εμφανιστεί εκείνο το ζευγάρι.
            </p>
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col gap-1.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
              <label className="text-xs font-medium text-ink-muted">Ερώτηση {i}</label>
              <input name={`faqQuestion${i}`} defaultValue={faq[i - 1]?.question ?? ""} className={field} />
              <label className="text-xs font-medium text-ink-muted">Απάντηση {i}</label>
              <textarea name={`faqAnswer${i}`} rows={2} defaultValue={faq[i - 1]?.answer ?? ""} className={field} />
            </div>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="isActive" defaultChecked={category?.isActive ?? true} className="h-4 w-4 accent-ink" />
        Ενεργή στο κατάστημα
      </label>

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
