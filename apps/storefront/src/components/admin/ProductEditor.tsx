"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  saveProductAction,
  saveVariantAction,
  deleteVariantAction,
  saveLengthRuleAction,
} from "@/lib/admin/catalog-actions";
import { formatMetres, stepsToMetres } from "@/lib/length";
import type { AdminProductDetail, CategoryOption } from "@/lib/admin/products";
import { CategorySelect } from "@/components/admin/CategorySelect";
import { DynamicMembership } from "@/components/admin/DynamicMembership";
import { ShippingFields } from "@/components/admin/ShippingFields";
import { ProductImageManager } from "@/components/admin/ProductImageManager";
import { InternalCodeField } from "@/components/admin/InternalCodeField";
import { AiSeoGenerator } from "@/components/admin/AiSeoGenerator";
import { money, centsToPriceInput } from "@/components/admin/ui/primitives";
import { publicImageUrl } from "@/lib/storage/urls";

/**
 * The product editor — the screen the store owner spends most of their time in.
 *
 * Two columns: content on the left, everything that decides how the product
 * behaves on the right. Common edits (price, stock, status) are always
 * visible without scrolling past a description field.
 *
 * A dirty indicator plus ⌘S/Ctrl+S, because the failure mode of an autosave
 * editor is uncertainty about whether something saved. Here it is explicit.
 *
 * Variants, photos and the AI panel sit inside this <form> visually but save
 * themselves; they are marked `data-own-save`. Typing there must not flag
 * this form as unsaved, and Enter there must not submit it — an input inside
 * a form submits that form on Enter, which used to save the product instead
 * of the variant price just typed, while showing "Αποθηκεύτηκε".
 */


const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";
const labelCls = "text-sm font-medium text-ink";
const hint = "text-xs text-ink-muted";

// Text-like inputs are the ones Enter submits the surrounding form from
// (HTML "implicit submission"); a file picker or checkbox uses Enter itself.
const NOT_TEXT = ["file", "checkbox", "radio", "button", "submit", "reset", "image", "color", "range"];
const submitsOnEnter = (el: EventTarget) => el instanceof HTMLInputElement && !NOT_TEXT.includes(el.type);

export function ProductEditor({
  product,
  categories,
  collections,
  pdpDefaults,
}: {
  product: AdminProductDetail;
  categories: CategoryOption[];
  collections: Array<{ id: string; title: string }>;
  // Shown as placeholder text in the override fields below, so the owner can
  // see what they're overriding without leaving this page.
  pdpDefaults: { pdpDeliveryText: string | null; pdpReturnsText: string | null; pdpPaymentText: string | null } | null;
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
      onChange={(e) => {
        if (!(e.target as Element).closest("[data-own-save]")) setDirty(true);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      onKeyDown={(e) => {
        const saveKey = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s";
        if ((e.target as Element).closest("[data-own-save]")) {
          if (saveKey || (e.key === "Enter" && submitsOnEnter(e.target))) e.preventDefault();
          return;
        }
        if (saveKey) {
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
            <InternalCodeField productId={product.id} defaultValue={product.internalCode} />
          </Panel>

          <LengthPanel product={product} />

          <VariantsPanel product={product} />

          <Panel title="Χαρακτηριστικά" hint="Εμφανίζονται στη σελίδα προϊόντος μόνο όσα συμπληρώσεις.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Μάρκα"
                htmlFor="brand"
                hint="Ο κατασκευαστής, π.χ. Tefal. Άφησέ το κενό αν το προϊόν δεν έχει μάρκα."
              >
                <input id="brand" name="brand" defaultValue={product.brand ?? ""} className={field} />
              </Field>
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

          <Panel
            title="Πληροφορίες προϊόντος"
            hint="Προαιρετικό — αντικαθιστά για αυτό το προϊόν μόνο την προεπιλογή από Περιεχόμενο → Header &amp; Footer. Άφησέ τα κενά για να ισχύει η γενική προεπιλογή."
          >
            <Field label="Παράδοση" htmlFor="deliveryTextOverride">
              <input
                id="deliveryTextOverride"
                name="deliveryTextOverride"
                placeholder={pdpDefaults?.pdpDeliveryText ?? ""}
                defaultValue={product.deliveryTextOverride ?? ""}
                className={field}
              />
            </Field>
            <Field label="Επιστροφές" htmlFor="returnsTextOverride">
              <input
                id="returnsTextOverride"
                name="returnsTextOverride"
                placeholder={pdpDefaults?.pdpReturnsText ?? ""}
                defaultValue={product.returnsTextOverride ?? ""}
                className={field}
              />
            </Field>
            <Field label="Πληρωμή" htmlFor="paymentTextOverride">
              <input
                id="paymentTextOverride"
                name="paymentTextOverride"
                placeholder={pdpDefaults?.pdpPaymentText ?? ""}
                defaultValue={product.paymentTextOverride ?? ""}
                className={field}
              />
            </Field>
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

          <div data-own-save>
            <AiSeoGenerator
              productId={product.id}
              hasExistingContent={Boolean(product.description || product.seo?.seoTitle || product.seo?.metaDescription)}
              isPublished={product.isActive}
              hasPrimaryImage={product.images.length > 0}
            />
          </div>

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
              hint={`Τα προϊόντα εμφανίζονται αυτόματα ως νέα για ${product.newArrivalWindowDays} ημέρες.`}
            />
            <Toggle
              name="isBestSeller"
              defaultChecked={product.isBestSeller}
              label="Best sellers"
              hint="Εμφανίζεται στη σελίδα Best sellers και στις ενότητες Best Sellers της αρχικής."
            />
          </Panel>

          <Panel title="Αυτόματες κατηγορίες">
            <DynamicMembership
              variants={product.variants}
              ageDays={product.ageDays}
              isNewOverride={product.isNewOverride}
              newArrivalWindowDays={product.newArrivalWindowDays}
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
            <div data-own-save>
              <ProductImageManager productId={product.id} productTitle={product.title} images={product.images} />
            </div>
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

/** 50 cm → "0,5" — how the length fields show a stored centimetre value. */
const cmToMetresInput = (cm: number) => (cm / 100).toLocaleString("el-GR", { maximumFractionDigits: 2 });

/**
 * «Πώληση με το μέτρο» (LENGTH_SALES_SPEC.md) — its own save, like the
 * variants below, because switching it changes what the variants' price and
 * stock mean (per metre, in metres) and touches stock and open carts
 * (saveLengthRule). Controlled inputs, no <form>: it sits inside the
 * product form, and forms can't nest.
 */
function LengthPanel({ product }: { product: AdminProductDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [enabled, setEnabled] = useState(product.length != null);
  const [step, setStep] = useState(cmToMetresInput(product.length?.stepCm ?? 50));
  const [min, setMin] = useState(cmToMetresInput(product.length?.minCm ?? 100));
  const [max, setMax] = useState(cmToMetresInput(product.length?.maxCm ?? 2000));

  // Switching the unit (or the step) resets/rescales stock and empties this
  // product from open carts — said before it happens, not discovered after.
  const unitChanges =
    enabled !== (product.length != null) ||
    (enabled && product.length != null && cmToMetresInput(product.length.stepCm) !== step.trim());

  function save() {
    const data = new FormData();
    data.set("enabled", enabled ? "on" : "off");
    data.set("step", step);
    data.set("min", min);
    data.set("max", max);
    startTransition(async () => {
      const result = await saveLengthRuleAction(product.id, data);
      setMsg(result.ok ? { ok: true, text: result.message ?? "Αποθηκεύτηκε." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <section
      data-own-save
      onKeyDown={(e) => {
        if (e.key === "Enter" && submitsOnEnter(e.target)) {
          e.preventDefault();
          if (!pending) save();
        }
      }}
      className="rounded-lg border border-border bg-bg p-5"
    >
      <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">Πώληση με το μέτρο</h2>
      <label className="mt-3 flex items-center gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-ink"
        />
        Ο πελάτης διαλέγει μήκος (π.χ. λάστιχο, σχοινί)
      </label>
      {enabled && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["Βήμα (μ)", step, setStep],
              ["Ελάχιστο (μ)", min, setMin],
              ["Μέγιστο ανά παραγγελία (μ)", max, setMax],
            ] as const
          ).map(([label, value, set]) => (
            <label key={label} className="flex flex-col gap-1.5">
              <span className={labelCls}>{label}</span>
              <input value={value} onChange={(e) => set(e.target.value)} inputMode="decimal" className={field} />
            </label>
          ))}
          <p className={`sm:col-span-3 ${hint}`}>
            Η τιμή της παραλλαγής γίνεται τιμή ανά μέτρο και το απόθεμα μετριέται σε μέτρα. Π.χ. βήμα 0,5 —
            ελάχιστο 1 — μέγιστο 20: ο πελάτης διαλέγει 1, 1,5, 2 … 20 μ.
          </p>
        </div>
      )}
      {unitChanges && (
        <p className="mt-3 rounded-md bg-accent/10 px-3 py-2 text-xs text-accent">
          Με την αλλαγή μονάδας, το απόθεμα {enabled && product.length ? "μετατρέπεται στο νέο βήμα" : "μηδενίζεται και το ξαναγράφεις"}{" "}
          και το προϊόν αφαιρείται από ανοιχτά καλάθια πελατών.
        </p>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-md bg-ink px-3.5 py-1.5 text-sm font-medium text-bg hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Αποθήκευση…" : "Αποθήκευση"}
        </button>
        {msg && (
          <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </section>
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
    <section data-own-save className="rounded-lg border border-border bg-bg p-5">
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
              images={product.images}
              lengthStepCm={product.length?.stepCm ?? null}
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
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {v.swatchHex && (
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 rounded-full border border-black/15"
                    style={{ backgroundColor: v.swatchHex }}
                  />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">
                    {isSingle && !v.swatchHex ? "Προεπιλογή" : v.title}
                  </div>
                  <div className={hint}>{v.sku}</div>
                </div>
              </div>
              <div className="text-sm tabular-nums">
                {money(v.priceCents)}
                {product.length && <span className="text-ink-muted">/μ</span>}
                {discount != null && (
                  <>
                    <span className="ml-2 text-ink-muted line-through">
                      {money(v.compareAtPriceCents ?? 0)}
                    </span>
                    <span className="ml-1.5 text-accent">−{discount}%</span>
                  </>
                )}
              </div>
              <div
                className={`min-w-16 text-right text-sm tabular-nums ${
                  v.stockQuantity <= 0 ? "text-danger" : v.stockQuantity <= 5 ? "text-accent" : "text-ink-muted"
                }`}
              >
                {product.length ? formatMetres(v.stockQuantity, product.length.stepCm) : `${v.stockQuantity} τεμ.`}
                {v.allowBackorder && <div className="text-xs text-accent">Κατόπιν παραγγελίας</div>}
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
            images={product.images}
            lengthStepCm={product.length?.stepCm ?? null}
            newDefaults={newVariantDefaults(product.variants)}
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
 * A new variant of a product is almost always another colour at the same
 * price, so the form opens with the first variant's prices and the next
 * free «-N» code after its SKU (00013 → 00013-2, 00013-3…). The suffix keeps
 * suggestNextSku's all-digit sequence untouched. Only suggestions — every
 * field stays editable.
 */
function newVariantDefaults(variants: AdminProductDetail["variants"]) {
  const base = variants[0];
  if (!base) return undefined;
  const root = base.sku.replace(/-\d+$/, "");
  const taken = new Set(variants.map((v) => v.sku));
  let n = 2;
  while (taken.has(`${root}-${n}`)) n++;
  return {
    sku: `${root}-${n}`,
    priceCents: base.priceCents,
    compareAtPriceCents: base.compareAtPriceCents,
    // Once one variant is a colour, the next one is too — open with the
    // colour field on (the owner still picks which colour).
    hasColour: variants.some((v) => v.swatchHex),
  };
}

// The usual colours, one click each; the picker next to them covers the rest.
const PRESET_COLOURS: { name: string; hex: string }[] = [
  { name: "Μαύρο", hex: "#1a1a1a" },
  { name: "Λευκό", hex: "#f5f5f5" },
  { name: "Γκρι", hex: "#8a8a8a" },
  { name: "Ασημί", hex: "#c0c0c0" },
  { name: "Κόκκινο", hex: "#d61f1f" },
  { name: "Μπλε", hex: "#1f3fbf" },
  { name: "Πράσινο", hex: "#2e8b3e" },
  { name: "Κίτρινο", hex: "#f2c200" },
  { name: "Πορτοκαλί", hex: "#f07a1a" },
  { name: "Ροζ", hex: "#e86aa6" },
  { name: "Μωβ", hex: "#7a3fb0" },
  { name: "Καφέ", hex: "#7a4a26" },
];

/**
 * Fully controlled, and builds its FormData explicitly rather than reading a
 * DOM form. Variants live visually inside the product form, and nesting a
 * <form> inside another is invalid HTML that browsers silently un-nest — so
 * there is no form element here to read from.
 */
function VariantForm({
  variant,
  images,
  lengthStepCm,
  newDefaults,
  pending,
  onCancel,
  onSubmit,
  onDelete,
}: {
  variant?: AdminProductDetail["variants"][number];
  images: AdminProductDetail["images"];
  // Sold by length: price per metre, stock typed in metres (stored as steps).
  lengthStepCm: number | null;
  newDefaults?: ReturnType<typeof newVariantDefaults>;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: FormData) => void;
  onDelete?: () => void;
}) {
  const [sku, setSku] = useState(variant?.sku ?? newDefaults?.sku ?? "");
  const [title, setTitle] = useState(variant?.title ?? (newDefaults?.hasColour ? "" : "Default"));
  const [price, setPrice] = useState(
    centsToPriceInput(variant?.priceCents ?? newDefaults?.priceCents ?? null)
  );
  const [compareAt, setCompareAt] = useState(
    centsToPriceInput(variant?.compareAtPriceCents ?? newDefaults?.compareAtPriceCents ?? null)
  );
  const [stock, setStock] = useState(
    lengthStepCm != null
      ? stepsToMetres(variant?.stockQuantity ?? 0, lengthStepCm).toLocaleString("el-GR", { maximumFractionDigits: 2 })
      : String(variant?.stockQuantity ?? 0)
  );
  const [onOrder, setOnOrder] = useState(variant?.allowBackorder ?? false);
  const [swatchHex, setSwatchHex] = useState<string | null>(
    variant ? variant.swatchHex : newDefaults?.hasColour ? PRESET_COLOURS[0].hex : null
  );
  const [imageId, setImageId] = useState<string | null>(variant?.imageId ?? null);

  // Picking a preset also names the variant, unless a name was already typed
  // (or the name is just another preset's — then it follows the new pick).
  function pickPreset(c: (typeof PRESET_COLOURS)[number]) {
    setSwatchHex(c.hex);
    const t = title.trim();
    if (!t || t === "Default" || PRESET_COLOURS.some((p) => p.name === t)) setTitle(c.name);
  }

  function buildFormData(): FormData {
    const data = new FormData();
    data.set("sku", sku);
    data.set("variantTitle", title);
    data.set("price", price);
    data.set("compareAtPrice", compareAt);
    data.set("stock", stock);
    data.set("allowBackorder", onOrder ? "on" : "off");
    data.set("swatchHex", swatchHex ?? "");
    data.set("imageId", imageId ?? "");
    // What this form showed on opening: unchanged means "leave stock as it
    // is now", so a sale made meanwhile isn't overwritten (saveVariant).
    if (variant) data.set("stockBefore", String(variant.stockQuantity));
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
    <div
      // Enter or ⌘S/Ctrl+S in a variant field saves the variant — the
      // product form above ignores keys from inside [data-own-save].
      onKeyDown={(e) => {
        const saveKey =
          (e.key === "Enter" && submitsOnEnter(e.target)) ||
          ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s");
        if (!saveKey) return;
        e.preventDefault();
        if (!pending) onSubmit(buildFormData());
      }}
      className="rounded-md border border-ink bg-surface/40 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Κωδικός (SKU)</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} required className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>{swatchHex ? "Όνομα χρώματος" : "Ονομασία παραλλαγής"}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={swatchHex ? "π.χ. Κόκκινο" : undefined}
            className={field}
          />
        </div>

        {/* Colour (0043): the dot shoppers pick on the card and the product
            page. Off = an ordinary variant, exactly as before. */}
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={swatchHex != null}
              onChange={(e) => {
                if (e.target.checked) pickPreset(PRESET_COLOURS[0]);
                else setSwatchHex(null);
              }}
              className="h-4 w-4 accent-ink"
            />
            Χρώμα
          </label>
          {swatchHex != null && (
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLOURS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={swatchHex === c.hex}
                  onClick={() => pickPreset(c)}
                  className={`h-7 w-7 rounded-full border border-black/15 ${
                    swatchHex === c.hex ? "ring-2 ring-ink ring-offset-2" : ""
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              <label className="ml-1 flex items-center gap-1.5 text-xs text-ink-muted">
                Άλλο:
                <input
                  type="color"
                  value={swatchHex}
                  onChange={(e) => setSwatchHex(e.target.value.toLowerCase())}
                  className="h-7 w-10 cursor-pointer rounded border border-border bg-bg p-0.5"
                />
              </label>
            </div>
          )}
        </div>

        {swatchHex != null && images.length > 0 && (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className={labelCls}>Φωτογραφία του χρώματος</span>
            <div className="flex flex-wrap gap-2">
              {images.map((img) => {
                const url = publicImageUrl(img.storagePath);
                const selected = imageId === img.id;
                return (
                  <button
                    key={img.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setImageId(selected ? null : img.id)}
                    className={`relative h-16 w-16 overflow-hidden rounded-md border-2 ${
                      selected ? "border-ink" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    {url && (
                      // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail, same as ProductImageManager
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className={hint}>
              Η φωτογραφία που εμφανίζεται όταν ο πελάτης διαλέγει αυτό το χρώμα. Ανέβασέ την πρώτα στις
              Φωτογραφίες του προϊόντος. Χωρίς επιλογή, εμφανίζεται η κύρια φωτογραφία.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>{lengthStepCm != null ? "Τιμή ανά μέτρο (€)" : "Τιμή πώλησης (€)"}</label>
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
          <label className={labelCls}>{lengthStepCm != null ? "Απόθεμα (μέτρα)" : "Απόθεμα"}</label>
          <input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" className={field} />
        </div>
        <label className="flex items-start gap-2 self-end pb-1 text-sm text-ink sm:col-span-2">
          <input
            type="checkbox"
            checked={onOrder}
            onChange={(e) => setOnOrder(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-ink"
          />
          <span>
            Κατόπιν παραγγελίας
            <span className={`block ${hint}`}>
              Όταν το απόθεμα φτάσει στο 0, ο πελάτης μπορεί να το παραγγείλει. Το παραγγέλνεις από τον
              προμηθευτή και τον ενημερώνεις για τον χρόνο παράδοσης. Όσο υπάρχει απόθεμα, το όριο είναι το
              απόθεμα.
            </span>
          </span>
        </label>
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
