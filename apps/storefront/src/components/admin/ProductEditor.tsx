"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveProductAction, saveVariantAction, deleteVariantAction } from "@/lib/admin/catalog-actions";
import type { AdminProductDetail, CategoryOption } from "@/lib/admin/products";
import { CategorySelect } from "@/components/admin/CategorySelect";
import { ShippingFields } from "@/components/admin/ShippingFields";

/**
 * The product editor — the screen the store owner spends most of their time in.
 *
 * Two columns: content on the left, everything that decides how the product
 * behaves on the right. Common edits (price, stock, status) are always
 * visible without scrolling past a description field.
 *
 * A dirty indicator plus ⌘S/Ctrl+S, because the failure mode of an autosave
 * editor is uncertainty about whether something saved. Here it is explicit.
 */

const money = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" });
const toInput = (cents: number | null) => (cents == null ? "" : (cents / 100).toFixed(2).replace(".", ","));

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";
const labelCls = "text-sm font-medium text-ink";
const hint = "text-xs text-ink-muted";

export function ProductEditor({
  product,
  categories,
  collections,
}: {
  product: AdminProductDetail;
  categories: CategoryOption[];
  collections: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    startTransition(async () => {
      const result = await saveProductAction(product.id, data);
      setFeedback(result.ok ? { ok: true, text: result.message ?? "Αποθηκεύτηκε." } : { ok: false, text: result.error });
      if (result.ok) {
        setDirty(false);
        router.refresh();
      }
    });
  }

  return (
    <form
      onChange={() => setDirty(true)}
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          submit(e.currentTarget);
        }
      }}
    >
      {/* Sticky action bar: the save button is never scrolled off a long form. */}
      <div className="sticky top-2 z-20 mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-ink">{product.title}</div>
          <div className={hint}>
            {dirty ? "Μη αποθηκευμένες αλλαγές" : "Όλες οι αλλαγές αποθηκεύτηκαν"}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/proionta/${product.slug}`}
            target="_blank"
            className="rounded-md border border-border px-3 py-1.5 text-sm text-ink hover:bg-surface"
          >
            Προβολή →
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-bg transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            {pending ? "Αποθήκευση…" : "Αποθήκευση"}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`mb-5 rounded-md border px-4 py-2.5 text-sm ${
            feedback.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        {/* ---------------- Left: content ---------------- */}
        <div className="flex flex-col gap-5">
          <Panel title="Βασικά στοιχεία">
            <Field label="Τίτλος" htmlFor="title">
              <input id="title" name="title" defaultValue={product.title} required className={field} />
            </Field>
            <Field
              label="Slug (URL)"
              htmlFor="slug"
              hint="Η αλλαγή του slug σπάει τους υπάρχοντες συνδέσμους προς αυτό το προϊόν."
            >
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-ink-muted">/proionta/</span>
                <input id="slug" name="slug" defaultValue={product.slug} required className={field} />
              </div>
            </Field>
            <Field label="Περιγραφή" htmlFor="description">
              <textarea
                id="description"
                name="description"
                rows={5}
                defaultValue={product.description ?? ""}
                className={field}
              />
            </Field>
          </Panel>

          <VariantsPanel product={product} />

          <Panel title="Χαρακτηριστικά" hint="Εμφανίζονται στη σελίδα προϊόντος μόνο όσα συμπληρώσεις.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Υλικό" htmlFor="material">
                <input id="material" name="material" defaultValue={product.material ?? ""} className={field} />
              </Field>
              <Field label="Βάρος (γραμμάρια)" htmlFor="weightGrams">
                <input
                  id="weightGrams"
                  name="weightGrams"
                  inputMode="numeric"
                  defaultValue={product.weightGrams ?? ""}
                  className={field}
                />
              </Field>
              <Field label="Μήκος (εκ.)" htmlFor="lengthCm">
                <input id="lengthCm" name="lengthCm" defaultValue={product.lengthCm ?? ""} className={field} />
              </Field>
              <Field label="Πλάτος (εκ.)" htmlFor="widthCm">
                <input id="widthCm" name="widthCm" defaultValue={product.widthCm ?? ""} className={field} />
              </Field>
              <Field label="Ύψος (εκ.)" htmlFor="heightCm">
                <input id="heightCm" name="heightCm" defaultValue={product.heightCm ?? ""} className={field} />
              </Field>
              <Field label="Χώρα προέλευσης" htmlFor="originCountry" hint="Κωδικός 2 γραμμάτων, π.χ. gr, it.">
                <input
                  id="originCountry"
                  name="originCountry"
                  maxLength={2}
                  defaultValue={product.originCountry ?? ""}
                  className={field}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Μεταφορικά">
            <ShippingFields
              defaultClass={product.shippingClass}
              defaultCostCents={product.shippingCostCents}
            />
          </Panel>

          <Panel title="Εμπορική προβολή">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ετικέτα (badge)" htmlFor="badgeLabel" hint="Προαιρετικό, π.χ. «Χειροποίητο».">
                <input id="badgeLabel" name="badgeLabel" defaultValue={product.badgeLabel ?? ""} className={field} />
              </Field>
              <Field label="Χρώμα ετικέτας" htmlFor="badgeTone">
                <select id="badgeTone" name="badgeTone" defaultValue={product.badgeTone} className={field}>
                  <option value="neutral">Ουδέτερο</option>
                  <option value="accent">Τονισμένο</option>
                  <option value="success">Πράσινο</option>
                </select>
              </Field>
            </div>
            <Field label="Κείμενο εγγύησης" htmlFor="warrantyText">
              <textarea
                id="warrantyText"
                name="warrantyText"
                rows={2}
                defaultValue={product.warrantyText ?? ""}
                className={field}
              />
            </Field>
            <Field label="Σύνδεσμος αρχείων" htmlFor="downloadsUrl">
              <input id="downloadsUrl" name="downloadsUrl" defaultValue={product.downloadsUrl ?? ""} className={field} />
            </Field>
          </Panel>

          <Panel title="SEO" hint="Αν τα αφήσεις κενά, χρησιμοποιείται ο τίτλος και η περιγραφή του προϊόντος.">
            <Field label="SEO τίτλος" htmlFor="seoTitle">
              <input id="seoTitle" name="seoTitle" defaultValue={product.seo?.seoTitle ?? ""} className={field} />
            </Field>
            <Field label="Meta περιγραφή" htmlFor="metaDescription">
              <textarea
                id="metaDescription"
                name="metaDescription"
                rows={2}
                defaultValue={product.seo?.metaDescription ?? ""}
                className={field}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Open Graph τίτλος" htmlFor="ogTitle">
                <input id="ogTitle" name="ogTitle" defaultValue={product.seo?.ogTitle ?? ""} className={field} />
              </Field>
              <Field label="Λέξεις-κλειδιά" htmlFor="keywords">
                <input id="keywords" name="keywords" defaultValue={product.seo?.keywords ?? ""} className={field} />
              </Field>
            </div>
            <Field label="Open Graph περιγραφή" htmlFor="ogDescription">
              <textarea
                id="ogDescription"
                name="ogDescription"
                rows={2}
                defaultValue={product.seo?.ogDescription ?? ""}
                className={field}
              />
            </Field>
            <Field label="Ευρετηρίαση" htmlFor="robots">
              <select id="robots" name="robots" defaultValue={product.seo?.robots ?? "index"} className={field}>
                <option value="index">Να ευρετηριάζεται (index)</option>
                <option value="noindex">Να μην ευρετηριάζεται (noindex)</option>
              </select>
            </Field>
          </Panel>
        </div>

        {/* ---------------- Right: behaviour ---------------- */}
        <div className="flex flex-col gap-5">
          <Panel title="Κατάσταση">
            <Toggle name="isActive" defaultChecked={product.isActive} label="Ενεργό στο κατάστημα" />
            <Toggle
              name="isNewOverride"
              defaultChecked={product.isNewOverride}
              label="Σήμανση ως «Νέο»"
              hint="Τα προϊόντα εμφανίζονται αυτόματα ως νέα για 30 ημέρες."
            />
          </Panel>

          <Panel title="Οργάνωση">
            <CategorySelect categories={categories} defaultValue={product.categoryId} />

            <fieldset>
              <legend className={labelCls}>Συλλογές</legend>
              {collections.length === 0 ? (
                <p className={`mt-1.5 ${hint}`}>
                  Δεν υπάρχουν συλλογές ακόμα.{" "}
                  <Link href="/admin/collections" className="underline">
                    Δημιούργησε μία
                  </Link>
                  .
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-1.5">
                  {collections.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        name="collectionIds"
                        value={c.id}
                        defaultChecked={product.collectionIds.includes(c.id)}
                        className="h-4 w-4 accent-ink"
                      />
                      {c.title}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          </Panel>

          <Panel title="Αναζήτηση">
            <Toggle name="hideFromSearch" defaultChecked={product.hideFromSearch} label="Απόκρυψη από την αναζήτηση" />
            <Toggle
              name="isSearchBoosted"
              defaultChecked={product.isSearchBoosted}
              label="Προτεραιότητα στην αναζήτηση"
              hint="Ανεβάζει το προϊόν μόνο όταν ταιριάζει πραγματικά με την αναζήτηση."
            />
          </Panel>

          <Panel title="Εικόνες">
            {/* Deliberately honest: uploads need Supabase Storage credentials
                that are not configured yet. Showing a dead upload button
                would be worse than saying so. */}
            {product.images.length === 0 ? (
              <p className={hint}>
                Δεν υπάρχουν εικόνες. Η μεταφόρτωση ενεργοποιείται μόλις ρυθμιστεί το Supabase Storage
                (δες PROJECT_MEMORY.md).
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {product.images.map((img) => (
                  <li key={img.id} className="truncate text-sm text-ink-muted">
                    {img.storagePath}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function Panel({ title, hint: h, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-bg p-5">
      <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">{title}</h2>
      {h && <p className={`mt-1 ${hint}`}>{h}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint: h,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
      </label>
      {children}
      {h && <p className={hint}>{h}</p>}
    </div>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
  hint: h,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-2.5 text-sm text-ink">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-ink" />
        {label}
      </label>
      {h && <p className={`mt-1 pl-6.5 ${hint}`}>{h}</p>}
    </div>
  );
}

/**
 * Variants save independently of the main form — a price change must not
 * require re-submitting the description, and nesting forms is invalid HTML.
 */
function VariantsPanel({ product }: { product: AdminProductDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const isSingle = product.variants.length === 1;

  function save(variantId: string | null, data: FormData) {
    if (variantId) data.set("variantId", variantId);
    startTransition(async () => {
      const result = await saveVariantAction(product.id, data);
      setMsg(result.ok ? { ok: true, text: result.message ?? "Αποθηκεύτηκε." } : { ok: false, text: result.error });
      if (result.ok) {
        setEditing(null);
        router.refresh();
      }
    });
  }

  function remove(variantId: string) {
    startTransition(async () => {
      const result = await deleteVariantAction(product.id, variantId);
      setMsg(result.ok ? { ok: true, text: result.message ?? "Διαγράφηκε." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-bg p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
          {isSingle ? "Τιμή & απόθεμα" : `Παραλλαγές (${product.variants.length})`}
        </h2>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="text-sm text-ink-muted underline hover:text-ink"
        >
          + Νέα παραλλαγή
        </button>
      </div>

      {msg && (
        <p role="status" className={`mt-3 text-sm ${msg.ok ? "text-success" : "text-danger"}`}>
          {msg.text}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {product.variants.map((v) => {
          const discount =
            v.compareAtPriceCents && v.compareAtPriceCents > v.priceCents
              ? Math.round(((v.compareAtPriceCents - v.priceCents) / v.compareAtPriceCents) * 100)
              : null;

          return editing === v.id ? (
            <VariantForm
              key={v.id}
              variant={v}
              pending={pending}
              onCancel={() => setEditing(null)}
              onSubmit={(data) => save(v.id, data)}
              onDelete={isSingle ? undefined : () => remove(v.id)}
            />
          ) : (
            <div
              key={v.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">{isSingle ? "Προεπιλογή" : v.title}</div>
                <div className={hint}>{v.sku}</div>
              </div>
              <div className="text-sm tabular-nums">
                {money.format(v.priceCents / 100)}
                {discount != null && (
                  <>
                    <span className="ml-2 text-ink-muted line-through">
                      {money.format((v.compareAtPriceCents ?? 0) / 100)}
                    </span>
                    <span className="ml-1.5 text-accent">−{discount}%</span>
                  </>
                )}
              </div>
              <div
                className={`w-16 text-right text-sm tabular-nums ${
                  v.stockQuantity <= 0 ? "text-danger" : v.stockQuantity <= 5 ? "text-accent" : "text-ink-muted"
                }`}
              >
                {v.stockQuantity} τεμ.
              </div>
              <button
                type="button"
                onClick={() => setEditing(v.id)}
                className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface"
              >
                Επεξεργασία
              </button>
            </div>
          );
        })}

        {editing === "new" && (
          <VariantForm
            pending={pending}
            onCancel={() => setEditing(null)}
            onSubmit={(data) => save(null, data)}
          />
        )}
      </div>
    </section>
  );
}

/**
 * Fully controlled, and builds its FormData explicitly rather than reading a
 * DOM form. Variants live visually inside the product form, and nesting a
 * <form> inside another is invalid HTML that browsers silently un-nest — so
 * there is no form element here to read from.
 */
function VariantForm({
  variant,
  pending,
  onCancel,
  onSubmit,
  onDelete,
}: {
  variant?: AdminProductDetail["variants"][number];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: FormData) => void;
  onDelete?: () => void;
}) {
  const [sku, setSku] = useState(variant?.sku ?? "");
  const [title, setTitle] = useState(variant?.title ?? "Default");
  const [price, setPrice] = useState(toInput(variant?.priceCents ?? null));
  const [compareAt, setCompareAt] = useState(toInput(variant?.compareAtPriceCents ?? null));
  const [stock, setStock] = useState(String(variant?.stockQuantity ?? 0));
  const [backorder, setBackorder] = useState(variant?.allowBackorder ?? false);

  function buildFormData(): FormData {
    const data = new FormData();
    data.set("sku", sku);
    data.set("variantTitle", title);
    data.set("price", price);
    data.set("compareAtPrice", compareAt);
    data.set("stock", stock);
    if (backorder) data.set("allowBackorder", "on");
    return data;
  }

  // The discount percentage the customer will see, computed as you type —
  // the brief asks for it to be automatic, and seeing it live is what stops
  // a "sale" price that is actually higher from being saved.
  const discount = useMemo(() => {
    const p = Number(price.replace(",", "."));
    const c = Number(compareAt.replace(",", "."));
    if (!Number.isFinite(p) || !Number.isFinite(c) || c <= p || c <= 0) return null;
    return Math.round(((c - p) / c) * 100);
  }, [price, compareAt]);

  return (
    <div className="rounded-md border border-ink bg-surface/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Κωδικός (SKU)</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} required className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Ονομασία παραλλαγής</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Τιμή πώλησης (€)</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            required
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Αρχική τιμή (€)</label>
          <input
            value={compareAt}
            onChange={(e) => setCompareAt(e.target.value)}
            inputMode="decimal"
            className={field}
          />
          <p className={hint}>
            {discount != null ? `Έκπτωση ${discount}% στο κατάστημα` : "Κενό αν δεν υπάρχει προσφορά"}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Απόθεμα</label>
          <input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" className={field} />
        </div>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={backorder}
              onChange={(e) => setBackorder(e.target.checked)}
              className="h-4 w-4 accent-ink"
            />
            Πώληση χωρίς απόθεμα
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onSubmit(buildFormData())}
          className="rounded-md bg-ink px-3.5 py-1.5 text-sm font-medium text-bg hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Αποθήκευση…" : "Αποθήκευση παραλλαγής"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3.5 py-1.5 text-sm hover:bg-surface"
        >
          Άκυρο
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="ml-auto rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/5"
          >
            Διαγραφή
          </button>
        )}
      </div>
    </div>
  );
}
