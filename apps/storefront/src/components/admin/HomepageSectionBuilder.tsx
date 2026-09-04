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
import type { HomepageSectionKind, PromoBanner2Config } from "@/lib/content-types";

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

// Hero and Promo render their image as a plain <img> with no server-side
// resizing (Hero.tsx, EditorialBanner.tsx) — unlike product photos, the
// exact file uploaded here is what every visitor downloads, so the source
// size/weight matters directly to page speed. Only the two kinds asked
// about get a hint; the others render through next/image (Content) or have
// no size-sensitive image use case worth a specific number (Newsletter).
const IMAGE_SIZE_HINTS: Partial<Record<HomepageSectionKind, { desktop: string; tablet?: string; mobile?: string }>> = {
  hero: {
    desktop:
      "Προτεινόμενο μέγεθος 1920×640px (JPEG/WebP, έως ~200KB) — χρησιμοποιείται σε desktop και tablet. Δεν αλλάζει μέγεθος αυτόματα.",
    // The 900×1200 (portrait) recommendation is calibrated for the
    // homepage's OPENING Hero specifically — that one alone gets the
    // full-screen-height treatment on mobile/tablet (hero-viewport-fill in
    // Hero.tsx). A second/later Hero an admin adds further down the page
    // is a fixed, much shorter box on every device (26rem/416px on mobile),
    // where a tall portrait source gets cropped hard — a shorter, more
    // landscape image works better there.
    mobile:
      "Προτεινόμενο μέγεθος 900×1200px, έως ~120KB — μόνο για κινητό (προαιρετικό· χωρίς αυτό, εμφανίζεται η desktop εικόνα παντού). Ισχύει για το πρώτο/κύριο Hero της αρχικής, που καλύπτει όλη την οθόνη σε κινητό. Ένα δεύτερο Hero πιο κάτω στη σελίδα είναι πάντα ένα κοντύτερο, σταθερού ύψους πλαίσιο — εκεί μια λιγότερο ψηλή (πιο οριζόντια) εικόνα ταιριάζει καλύτερα.",
  },
  // Banner 1's own field — see BANNER2_IMAGE_HINTS just below for Banner 2,
  // which is a genuinely different target shape (always a fixed-ratio card,
  // never the auto-height layout Banner 1 alone uses).
  promo: {
    // Banner 1 alone (no Banner 2 filled in) has NO single fixed ratio: on
    // mobile it's a square crop, but on desktop/tablet it stretches to
    // match the text panel's own height (EditorialBanner.tsx's
    // `md:aspect-auto md:h-full`), which varies with how much copy is in
    // the banner — a square-ish, centered source crops reasonably in both
    // cases. The MOMENT Banner 2 is also filled in, both banners switch to
    // the fixed 4:3 card layout instead (see PromoBannerCard) — a
    // different target shape, so a square Banner 1 image chosen for the
    // solo layout will crop top/bottom once Banner 2 makes it a 4:3 card.
    desktop:
      "Προτεινόμενο μέγεθος 1200×1200px (τετράγωνο, JPEG/WebP, έως ~150KB) αν χρησιμοποιείς ΜΟΝΟ αυτό το banner (χωρίς Banner 2 πιο κάτω) — έτσι γεμίζει καλά είτε σε τετράγωνη περικοπή (κινητό) είτε στο πλάτος της στήλης (desktop/tablet). Αν συμπληρώσεις και το Banner 2, αλλάζει layout σε κάρτα σταθερής αναλογίας 4:3 — τότε προτίμησε πλατύτερη εικόνα, π.χ. 1600×1200px, όπως στο Banner 2 πιο κάτω. Δεν αλλάζει μέγεθος αυτόματα.",
    tablet: "Προαιρετικό — χωρίς αυτό, εμφανίζεται η desktop εικόνα σε tablet.",
    mobile: "Προτεινόμενο μέγεθος 900×900px — προαιρετικό· χωρίς αυτό, εμφανίζεται η desktop εικόνα σε κινητό.",
  },
};

// Banner 2 only ever renders inside PromoBannerCard (EditorialBanner.tsx),
// which is a fixed 4:3 `aspect-[4/3]` box on every breakpoint — unlike
// Banner 1 above, there is exactly one target shape here, not two, so a
// 4:3 source crops to nothing at all instead of being a compromise.
const BANNER2_IMAGE_HINTS = {
  desktop: "Προτεινόμενο μέγεθος 1600×1200px (αναλογία 4:3, JPEG/WebP, έως ~150KB) — εμφανίζεται πάντα σε κάρτα αυτής της αναλογίας, σε desktop, tablet και κινητό. Δεν αλλάζει μέγεθος αυτόματα.",
  tablet: "Προαιρετικό — χωρίς αυτό, εμφανίζεται η desktop εικόνα σε tablet.",
  mobile: "Προαιρετικό — χωρίς αυτό, εμφανίζεται η desktop εικόνα σε κινητό. Ίδια αναλογία 4:3 αν το ανεβάσεις ξεχωριστά.",
};

const SOURCE_LABELS: Record<string, string> = {
  newest: "Νεότερα προϊόντα",
  featured: "Προτεινόμενα",
  sale: "Σε προσφορά",
  category: "Από κατηγορία",
  collection: "Από συλλογή",
  manual: "Χειροκίνητη επιλογή",
  best_sellers: "Best Sellers (αυτόματα, με βάση τις πωλήσεις)",
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
            <ImageUploadField
              id="imagePath"
              name="imagePath"
              defaultValue={section?.imagePath}
              folder="homepage"
              hint={IMAGE_SIZE_HINTS[kind]?.desktop}
            />
          </div>
          {/* Tablet is currently Promo-only (Banner 1) — Hero/Content/Newsletter
              keep their existing desktop+mobile pair unchanged, out of scope
              for this feature. */}
          {kind === "promo" && (
            <div>
              <label className={label} htmlFor="tabletImagePath">Εικόνα (tablet — προαιρετικό)</label>
              <ImageUploadField
                id="tabletImagePath"
                name="tabletImagePath"
                defaultValue={section?.tabletImagePath}
                folder="homepage"
                placeholder="Προαιρετικό — αλλιώς χρησιμοποιείται η desktop"
                hint={IMAGE_SIZE_HINTS[kind]?.tablet}
              />
            </div>
          )}
          <div>
            <label className={label} htmlFor="mobileImagePath">Εικόνα (mobile — προαιρετικό)</label>
            <ImageUploadField
              id="mobileImagePath"
              name="mobileImagePath"
              defaultValue={section?.mobileImagePath}
              folder="homepage"
              placeholder="Προαιρετικό — αλλιώς χρησιμοποιείται η desktop"
              hint={IMAGE_SIZE_HINTS[kind]?.mobile}
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

      {/* After Banner 1's own fields (copy/image/button above) so the form
          reads as "Banner 1 in full, then optional Banner 2" rather than
          interleaving the two. */}
      {kind === "promo" && (
        <Banner2Fields
          config={section?.config}
          categories={categories}
          collections={collections}
        />
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

          {sourceType === "best_sellers" && (
            <div className="mt-3">
              <p className={label}>Εφεδρικά προϊόντα (προαιρετικό)</p>
              <p className="mb-2 text-xs text-ink-muted">
                Εμφανίζονται μόνο όσο δεν υπάρχουν ακόμα αρκετές πωλήσεις για αυτόματη κατάταξη — π.χ. σε ένα νέο
                κατάστημα. Μόλις υπάρξουν πραγματικές πωλήσεις, εμφανίζονται αυτές αντί για τα εφεδρικά.
              </p>
              <ProductPicker
                name="fallbackProductSlugs"
                defaultSlugs={src?.type === "best_sellers" ? (src.fallbackProductSlugs ?? []) : []}
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
 * The Promotional Banner's second, independently-configurable banner.
 * Entirely optional — every field starts empty for a promo block saved
 * before this existed, and leaving all of them empty keeps that block
 * rendering as a single banner (see EditorialBanner.tsx's hasBanner2 check
 * and cms-actions.ts's parseConfig, which only writes `config.banner2` at
 * all when at least one of these fields is non-empty).
 */
function Banner2Fields({
  config,
  categories,
  collections,
}: {
  config?: { banner2?: PromoBanner2Config };
  categories: PickerOption[];
  collections: PickerOption[];
}) {
  const banner2 = config?.banner2;
  return (
    <div className="rounded-md border border-border p-3">
      <p className="mb-3 text-sm font-medium text-ink">Banner 2 (προαιρετικό)</p>
      <p className="mb-3 text-xs text-ink-muted">
        Αν συμπληρωθεί, το «Banner 2» εμφανίζεται δίπλα στο πρώτο banner σε desktop/tablet και από κάτω του σε
        κινητό. Αν μείνει κενό, εμφανίζεται μόνο το πρώτο banner, όπως και σήμερα.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={label} htmlFor="banner2DesktopImagePath">Εικόνα (desktop)</label>
          <ImageUploadField
            id="banner2DesktopImagePath"
            name="banner2DesktopImagePath"
            defaultValue={banner2?.desktopImagePath}
            folder="homepage"
            hint={BANNER2_IMAGE_HINTS.desktop}
          />
        </div>
        <div>
          <label className={label} htmlFor="banner2TabletImagePath">Εικόνα (tablet — προαιρετικό)</label>
          <ImageUploadField
            id="banner2TabletImagePath"
            name="banner2TabletImagePath"
            defaultValue={banner2?.tabletImagePath}
            folder="homepage"
            placeholder="Προαιρετικό — αλλιώς χρησιμοποιείται η desktop"
            hint={BANNER2_IMAGE_HINTS.tablet}
          />
        </div>
        <div>
          <label className={label} htmlFor="banner2MobileImagePath">Εικόνα (mobile — προαιρετικό)</label>
          <ImageUploadField
            id="banner2MobileImagePath"
            name="banner2MobileImagePath"
            defaultValue={banner2?.mobileImagePath}
            folder="homepage"
            placeholder="Προαιρετικό — αλλιώς χρησιμοποιείται η desktop"
            hint={BANNER2_IMAGE_HINTS.mobile}
          />
        </div>
        <div>
          <label className={label} htmlFor="banner2ImageAlt">Εναλλακτικό κείμενο εικόνας (alt)</label>
          <input
            id="banner2ImageAlt"
            name="banner2ImageAlt"
            defaultValue={banner2?.imageAlt ?? ""}
            placeholder="Τι δείχνει η εικόνα"
            className={field}
          />
        </div>
        <div>
          <label className={label} htmlFor="banner2Heading">Τίτλος</label>
          <input id="banner2Heading" name="banner2Heading" defaultValue={banner2?.heading ?? ""} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="banner2CtaLabel">Κείμενο κουμπιού</label>
          <input id="banner2CtaLabel" name="banner2CtaLabel" defaultValue={banner2?.ctaLabel ?? ""} className={field} />
        </div>
        <div className="md:col-span-2">
          <label className={label} htmlFor="banner2Body">Υπότιτλος / Περιγραφή</label>
          <textarea id="banner2Body" name="banner2Body" rows={2} defaultValue={banner2?.body ?? ""} className={field} />
        </div>
        <div className="md:col-span-2">
          <label className={label} htmlFor="banner2CtaHref">Προορισμός κουμπιού</label>
          <LinkPicker
            name="banner2CtaHref"
            defaultValue={banner2?.ctaHref ?? ""}
            categories={categories}
            collections={collections}
          />
        </div>
      </div>
    </div>
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
