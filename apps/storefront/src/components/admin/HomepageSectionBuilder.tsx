"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteHomepageBlockAction,
  duplicateHomepageBlockAction,
  moveHomepageBlockAction,
  saveHomepageBlockAction,
  setHomepageBlockPublishedAction,
} from "@/lib/admin/cms-actions";
import { ProductPicker } from "@/components/admin/ProductPicker";
import { TrustItemsEditor } from "@/components/admin/TrustItemsEditor";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { DEFAULT_TRUST_ITEMS } from "@/components/home/TrustStrip";
import type { AdminHomepageBlock } from "@/lib/admin/cms";
import type { HomepageSectionKind } from "@/lib/content-types";

/**
 * The homepage, as an ordered list of sections the owner composes.
 *
 * Deliberately not a drag-and-drop page builder: up/down buttons are
 * keyboard-accessible, work on touch without a gesture library, and can't
 * half-apply a reorder if the request fails. The list is the page order,
 * top to bottom, which is the whole mental model.
 *
 * Hidden sections stay visible here (greyed, with a badge) rather than being
 * filtered out — "where did my draft go" is a worse problem than a slightly
 * busier list.
 */

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";
const label = "block text-xs font-medium text-ink-muted mb-1";

const KIND_LABELS: Record<HomepageSectionKind, string> = {
  hero: "Hero / Μεγάλο banner",
  promo: "Προωθητικό banner",
  category_grid: "Πλέγμα κατηγοριών",
  product_rail: "Λωρίδα προϊόντων",
  content: "Κείμενο & εικόνα",
  trust: "Εγγυήσεις καταστήματος",
  newsletter: "Newsletter",
};

const KIND_HINTS: Record<HomepageSectionKind, string> = {
  hero: "Μεγάλη εικόνα με τίτλο και προαιρετικό κουμπί. Δύο ή περισσότερα διαδοχικά hero γίνονται carousel.",
  promo: "Μικρότερο banner εικόνας/κειμένου, σε δύο στήλες.",
  category_grid: "Πλακίδια κατηγοριών. Άφησε τη λίστα κενή για όλες τις κύριες κατηγορίες.",
  product_rail: "Οριζόντια λωρίδα προϊόντων — αυτόματη επιλογή ή χειροκίνητη.",
  content: "Ελεύθερη ενότητα: εικόνα, τίτλος, κείμενο και προαιρετικό κουμπί.",
  trust:
    "Τα πλακίδια εγγυήσεων. Διάλεξε εικονίδιο και γράψε το δικό σου κείμενο σε καθένα.",
  newsletter:
    "Η φόρμα εγγραφής. Τίτλος, κείμενο, κουμπί και προαιρετική εικόνα φόντου είναι δικά σου — η αποστολή email δεν είναι ακόμα συνδεδεμένη.",
};

const SOURCE_LABELS: Record<string, string> = {
  newest: "Νεότερα προϊόντα",
  featured: "Προτεινόμενα",
  sale: "Σε προσφορά",
  category: "Από κατηγορία",
  collection: "Από συλλογή",
  manual: "Χειροκίνητη επιλογή",
};

export type PickerOption = { slug: string; label: string };

export function HomepageSectionBuilder({
  sections,
  categories,
  collections,
}: {
  sections: AdminHomepageBlock[];
  categories: PickerOption[];
  collections: PickerOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [addingKind, setAddingKind] = useState<HomepageSectionKind | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminHomepageBlock | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      setMsg(
        result.ok
          ? { ok: true, text: result.message ?? "Έγινε." }
          : { ok: false, text: result.error ?? "Κάτι πήγε στραβά." }
      );
      if (result.ok) {
        setEditing(null);
        setAddingKind(null);
        setConfirmDelete(null);
        router.refresh();
      }
    });
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Ενότητες αρχικής</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Με τη σειρά που εμφανίζονται στο κατάστημα. {sections.length} ενότητες,{" "}
            {sections.filter((s) => s.isPublished).length} ορατές.
            {sections.some(isDeadOnLive) && (
              <span className="ml-1 font-medium text-danger">
                {sections.filter(isDeadOnLive).length} δεν εμφανίζονται live παρότι είναι ορατές — δες την προειδοποίηση πιο κάτω.
              </span>
            )}
          </p>
        </div>
      </div>

      {msg && (
        <p
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            msg.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"
          }`}
          role="status"
        >
          {msg.text}
        </p>
      )}

      {/* Add — the kind is chosen up front because the fields differ per kind. */}
      <div className="mb-6 rounded-lg border border-dashed border-border p-4">
        <p className={label}>Προσθήκη ενότητας</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KIND_LABELS) as HomepageSectionKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                setAddingKind(kind);
                setEditing(null);
              }}
              className="rounded-sm border border-border px-3 py-1.5 text-sm text-ink transition-colors hover:border-ink"
            >
              + {KIND_LABELS[kind]}
            </button>
          ))}
        </div>
        {addingKind && (
          <div className="mt-4">
            <SectionForm
              kind={addingKind}
              categories={categories}
              collections={collections}
              // New sections go to the end: sort_order above every existing one.
              defaultSortOrder={(sections.at(-1)?.sortOrder ?? 0) + 10}
              pending={pending}
              onCancel={() => setAddingKind(null)}
              onSubmit={(data) => run(() => saveHomepageBlockAction(data))}
            />
          </div>
        )}
      </div>

      {sections.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-ink">Καμία ενότητα ακόμα.</p>
          <p className="mt-1 text-xs text-ink-muted">
            Μέχρι να προσθέσεις ενότητες, η αρχική δείχνει το προεπιλεγμένο hero και τις κατηγορίες.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sections.map((section, i) => (
            <li key={section.id} className="rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-3 p-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {section.heading || KIND_LABELS[section.kind]}
                    </span>
                    <span className="rounded-sm bg-surface px-1.5 py-0.5 text-[11px] text-ink-muted">
                      {KIND_LABELS[section.kind]}
                    </span>
                    {!section.isPublished && (
                      <span className="rounded-sm bg-surface-strong px-1.5 py-0.5 text-[11px] text-ink-muted">
                        Κρυφή
                      </span>
                    )}
                    {isDeadOnLive(section) && (
                      <span className="rounded-sm bg-danger/10 px-1.5 py-0.5 text-[11px] font-medium text-danger">
                        ⚠ Δεν εμφανίζεται live — λείπει επιλογή
                      </span>
                    )}
                  </div>
                  <span className="truncate text-xs text-ink-muted">
                    {describeSection(section)}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    label="Μετακίνηση πάνω"
                    disabled={pending || i === 0}
                    onClick={() => run(() => moveHomepageBlockAction(section.id, "up"))}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    label="Μετακίνηση κάτω"
                    disabled={pending || i === sections.length - 1}
                    onClick={() => run(() => moveHomepageBlockAction(section.id, "down"))}
                  >
                    ↓
                  </IconButton>
                  <TextButton
                    disabled={pending}
                    onClick={() =>
                      run(() => setHomepageBlockPublishedAction(section.id, !section.isPublished))
                    }
                  >
                    {section.isPublished ? "Απόκρυψη" : "Εμφάνιση"}
                  </TextButton>
                  <TextButton
                    disabled={pending}
                    onClick={() => {
                      setEditing(editing === section.id ? null : section.id);
                      setAddingKind(null);
                    }}
                  >
                    Επεξεργασία
                  </TextButton>
                  <TextButton
                    disabled={pending}
                    onClick={() => run(() => duplicateHomepageBlockAction(section.id))}
                  >
                    Αντιγραφή
                  </TextButton>
                  <TextButton disabled={pending} danger onClick={() => setConfirmDelete(section)}>
                    Διαγραφή
                  </TextButton>
                </div>
              </div>

              {editing === section.id && (
                <div className="border-t border-border p-4">
                  <SectionForm
                    kind={section.kind}
                    section={section}
                    categories={categories}
                    collections={collections}
                    defaultSortOrder={section.sortOrder}
                    pending={pending}
                    onCancel={() => setEditing(null)}
                    onSubmit={(data) => run(() => saveHomepageBlockAction(data))}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-lg bg-bg p-5 shadow-xl">
            <h3 className="text-base font-semibold text-ink">Διαγραφή ενότητας</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Θα διαγραφεί η ενότητα{" "}
              <strong className="text-ink">
                {confirmDelete.heading || KIND_LABELS[confirmDelete.kind]}
              </strong>
              .
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-sm border border-border px-4 py-2 text-sm text-ink"
                onClick={() => setConfirmDelete(null)}
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-sm bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={() => run(() => deleteHomepageBlockAction(confirmDelete.id))}
              >
                Διαγραφή
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * True when a published section is guaranteed to render nothing live — a
 * product rail whose source reference (category/collection/manual picks)
 * was never actually set. Same class of problem `validateRailSource` in
 * cms-actions.ts now blocks on save, surfaced here too so a row saved
 * before that check existed doesn't sit invisible and undiagnosable.
 */
function isDeadOnLive(s: AdminHomepageBlock): boolean {
  if (!s.isPublished || s.kind !== "product_rail") return false;
  const source = s.config.source;
  if (!source) return true;
  if (source.type === "category") return !source.categorySlug;
  if (source.type === "collection") return !source.collectionSlug;
  if (source.type === "manual") return !source.productSlugs?.length;
  return false;
}

/** One-line summary of what a section will actually render. */
function describeSection(s: AdminHomepageBlock): string {
  switch (s.kind) {
    case "product_rail": {
      const src = s.config.source;
      if (!src) return "Καμία πηγή προϊόντων";
      if (src.type === "manual") return `${src.productSlugs?.length ?? 0} επιλεγμένα προϊόντα`;
      if (src.type === "category") return `Κατηγορία: ${src.categorySlug || "—"}`;
      if (src.type === "collection") return `Συλλογή: ${src.collectionSlug || "—"}`;
      return SOURCE_LABELS[src.type] ?? src.type;
    }
    case "category_grid": {
      const n = s.config.categorySlugs?.length ?? 0;
      return n > 0 ? `${n} επιλεγμένες κατηγορίες` : "Όλες οι κύριες κατηγορίες";
    }
    default:
      return s.body?.slice(0, 80) || s.ctaHref || "—";
  }
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
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-ink transition-colors hover:border-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function TextButton({
  children,
  disabled,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-sm px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
        danger ? "text-danger hover:bg-danger/5" : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function SectionForm({
  kind,
  section,
  categories,
  collections,
  defaultSortOrder,
  pending,
  onCancel,
  onSubmit,
}: {
  kind: HomepageSectionKind;
  section?: AdminHomepageBlock;
  categories: PickerOption[];
  collections: PickerOption[];
  defaultSortOrder: number;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: FormData) => void;
}) {
  const [sourceType, setSourceType] = useState(section?.config.source?.type ?? "newest");
  const src = section?.config.source;
  // `trust` has no free-text copy of its own (its content is the item list);
  // `newsletter` reuses the standard copy columns and an optional background
  // image, so it is NOT treated as fieldless.
  const isTrust = kind === "trust";
  const isNewsletter = kind === "newsletter";
  const hasCopy = !isTrust;
  const hasBody = kind === "hero" || kind === "promo" || kind === "content" || isNewsletter;
  const hasButton = kind === "hero" || kind === "promo" || kind === "content";
  const hasImage = kind === "hero" || kind === "promo" || kind === "content" || isNewsletter;

  return (
    <form
      action={(data) => {
        data.set("kind", kind);
        if (section) data.set("id", section.id);
        onSubmit(data);
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-xs text-ink-muted">{KIND_HINTS[kind]}</p>

      {isTrust && <TrustItemsEditor defaultItems={section?.config.items ?? DEFAULT_TRUST_ITEMS} />}


      {/* Copy — every kind uses heading; the rest depend on the kind.
          Fixed-content kinds skip all of it: their text lives in code. */}
      {hasCopy && (
        <div className="grid gap-3 md:grid-cols-2">
          {kind !== "category_grid" && (
            <div>
              <label className={label} htmlFor="eyebrow">Μικρός τίτλος (eyebrow)</label>
              <input id="eyebrow" name="eyebrow" defaultValue={section?.eyebrow ?? ""} className={field} />
            </div>
          )}
          <div>
            <label className={label} htmlFor="heading">Τίτλος</label>
            <input id="heading" name="heading" defaultValue={section?.heading ?? ""} className={field} />
          </div>
        </div>
      )}

      {hasBody && (
        <div>
          <label className={label} htmlFor="body">Κείμενο</label>
          <textarea id="body" name="body" rows={3} defaultValue={section?.body ?? ""} className={field} />
        </div>
      )}

      {hasImage && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={label} htmlFor="imagePath">Εικόνα (desktop)</label>
            <ImageUploadField id="imagePath" name="imagePath" defaultValue={section?.imagePath} folder="homepage" />
          </div>
          <div>
            <label className={label} htmlFor="mobileImagePath">Εικόνα (mobile)</label>
            <ImageUploadField
              id="mobileImagePath"
              name="mobileImagePath"
              defaultValue={section?.mobileImagePath}
              folder="homepage"
              placeholder="Προαιρετικό — αλλιώς χρησιμοποιείται η desktop"
            />
          </div>
          <div className="md:col-span-2">
            <label className={label} htmlFor="imageAlt">Εναλλακτικό κείμενο εικόνας (alt)</label>
            <input
              id="imageAlt"
              name="imageAlt"
              defaultValue={section?.imageAlt ?? ""}
              placeholder="Τι δείχνει η εικόνα — για SEO και προσβασιμότητα"
              className={field}
            />
          </div>
        </div>
      )}

      {hasButton && (
        <div className="rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="showButton"
              defaultChecked={section ? section.config.showButton !== false : true}
              className="h-4 w-4"
            />
            Εμφάνιση κουμπιού
          </label>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className={label} htmlFor="ctaLabel">Κείμενο κουμπιού</label>
              <input id="ctaLabel" name="ctaLabel" defaultValue={section?.ctaLabel ?? ""} className={field} />
            </div>
            <div>
              <label className={label} htmlFor="ctaHref">Προορισμός</label>
              <LinkPicker
                name="ctaHref"
                defaultValue={section?.ctaHref ?? ""}
                categories={categories}
                collections={collections}
              />
            </div>
          </div>
        </div>
      )}

      {kind === "category_grid" && (
        <div>
          <label className={label} htmlFor="categorySlugs">Κατηγορίες</label>
          <textarea
            id="categorySlugs"
            name="categorySlugs"
            rows={3}
            defaultValue={(section?.config.categorySlugs ?? []).join("\n")}
            placeholder="Ένα slug ανά γραμμή, με τη σειρά που θέλεις. Κενό = όλες οι κύριες κατηγορίες."
            className={field}
          />
          <p className="mt-1 text-xs text-ink-muted">
            Διαθέσιμα: {categories.map((c) => c.slug).join(", ")}
          </p>
        </div>
      )}

      {kind === "product_rail" && (
        <div className="rounded-md border border-border p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={label} htmlFor="sourceType">Πηγή προϊόντων</label>
              <select
                id="sourceType"
                name="sourceType"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as typeof sourceType)}
                className={field}
              >
                {Object.entries(SOURCE_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </div>
            {sourceType !== "manual" && (
              <div>
                <label className={label} htmlFor="limit">Πλήθος προϊόντων</label>
                <input
                  id="limit"
                  name="limit"
                  type="number"
                  min={1}
                  max={24}
                  defaultValue={src && "limit" in src ? src.limit : 12}
                  className={field}
                />
              </div>
            )}
          </div>

          {sourceType === "category" && (
            <div className="mt-3">
              <label className={label} htmlFor="categorySlug">Κατηγορία</label>
              <select
                id="categorySlug"
                name="categorySlug"
                defaultValue={src?.type === "category" ? src.categorySlug : ""}
                className={field}
              >
                <option value="">— Επίλεξε —</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          {sourceType === "collection" && (
            <div className="mt-3">
              <label className={label} htmlFor="collectionSlug">Συλλογή</label>
              <select
                id="collectionSlug"
                name="collectionSlug"
                defaultValue={src?.type === "collection" ? src.collectionSlug : ""}
                className={field}
              >
                <option value="">— Επίλεξε —</option>
                {collections.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.label}</option>
                ))}
              </select>
              {collections.length === 0 && (
                <p className="mt-1 text-xs text-ink-muted">
                  Δεν υπάρχουν συλλογές ακόμα — δημιούργησε μία από τις Συλλογές.
                </p>
              )}
            </div>
          )}

          {sourceType === "manual" && (
            <div className="mt-3">
              <p className={label}>Προϊόντα</p>
              <ProductPicker
                name="productSlugs"
                defaultSlugs={src?.type === "manual" ? (src.productSlugs ?? []) : []}
              />
            </div>
          )}

          <div className="mt-3">
            <label className={label} htmlFor="viewAllHref">Σύνδεσμος «Δες όλα» (προαιρετικό)</label>
            <LinkPicker
              name="viewAllHref"
              defaultValue={section?.config.viewAllHref ?? ""}
              categories={categories}
              collections={collections}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={section?.isPublished ?? false}
            className="h-4 w-4"
          />
          Ορατή στο κατάστημα
        </label>
        <input type="hidden" name="sortOrder" value={defaultSortOrder} />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Αποθήκευση…" : "Αποθήκευση"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm border border-border px-4 py-2 text-sm text-ink"
        >
          Άκυρο
        </button>
      </div>
    </form>
  );
}

/**
 * Destination picker: choose a category or collection, or type any URL.
 *
 * Writes a plain path into one hidden input rather than storing a typed
 * {kind, ref} pair — the storefront only ever needs an href, and this keeps
 * "any custom URL" working without a resolution layer.
 */
function LinkPicker({
  name,
  defaultValue,
  categories,
  collections,
}: {
  name: string;
  defaultValue: string;
  categories: PickerOption[];
  collections: PickerOption[];
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex flex-col gap-2">
      <input
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="/kouzina, /syllogi/…, /proionta/… ή https://…"
        className={field}
      />
      <select
        aria-label="Γρήγορη επιλογή προορισμού"
        value=""
        onChange={(e) => e.target.value && setValue(e.target.value)}
        className="w-full rounded-md border border-border bg-bg px-3 py-1.5 text-xs text-ink-muted"
      >
        <option value="">Γρήγορη επιλογή…</option>
        <optgroup label="Κατηγορίες">
          {categories.map((c) => (
            <option key={c.slug} value={`/${c.slug}`}>{c.label}</option>
          ))}
        </optgroup>
        {collections.length > 0 && (
          <optgroup label="Συλλογές">
            {collections.map((c) => (
              <option key={c.slug} value={`/syllogi/${c.slug}`}>{c.label}</option>
            ))}
          </optgroup>
        )}
        <optgroup label="Σελίδες">
          <option value="/nea-afiksi">Νέες αφίξεις</option>
          <option value="/protainomena">Προτεινόμενα</option>
        </optgroup>
      </select>
    </div>
  );
}
