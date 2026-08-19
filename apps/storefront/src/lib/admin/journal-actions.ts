"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog, requireAdmin } from "@/lib/admin/auth";
import {
  JournalError,
  createJournalArticle,
  deleteJournalArticle,
  deleteJournalCategory,
  saveJournalCategory,
  setJournalArticleStatus,
  updateJournalArticle,
  type JournalStatus,
} from "@/lib/admin/journal";
import { slugify } from "@/lib/admin/products";
import { JOURNAL_CACHE_TAG } from "@/lib/data/journal";
import { isCalendarDate } from "@/lib/dates";
import type { ActionResult } from "@/lib/admin/catalog-actions";

/**
 * Journal writes.
 *
 * Every action calls requireAdmin() FIRST, before reading its arguments — a
 * Server Action is a public HTTP endpoint that the proxy's /admin cookie
 * check never sees, so the session check cannot live anywhere else. This is
 * the same contract catalog-actions.ts and cms-actions.ts hold.
 *
 * Every write invalidates BOTH the admin route and the storefront's journal
 * cache tag. Without the tag an edit would sit invisible behind the 60s
 * revalidate window and read as "the save didn't work".
 */

const EXPIRED: ActionResult = { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };

const text = (v: FormDataEntryValue | null): string | null => {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : null;
};

/** Newline- or comma-separated slugs, exactly the wire format ProductPicker emits. */
const slugList = (v: FormDataEntryValue | null): string[] =>
  String(v ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

function mapError(err: unknown): string {
  if (err instanceof JournalError) {
    switch (err.code) {
      case "duplicate_slug": return "Υπάρχει ήδη άρθρο ή κατηγορία με αυτό το slug.";
      case "reserved_slug": return "Το slug «kategoria» χρησιμοποιείται από το ίδιο το Journal. Διάλεξε άλλο.";
      case "invalid_slug": return "Το slug δεν μπορεί να είναι κενό.";
      case "not_found": return "Δεν βρέθηκε.";
    }
  }
  if (err instanceof Error && err.message === "Not authenticated") {
    return "Η συνεδρία σου έληξε. Συνδέσου ξανά.";
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}

async function guard(): Promise<{ id: string } | null> {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

/**
 * The storefront surfaces an article can appear on. Called after every write
 * — an article edit can change the landing page (lead article, card list),
 * its own page, and its category page all at once.
 */
function revalidateJournal(slug?: string) {
  updateTag(JOURNAL_CACHE_TAG);
  revalidatePath("/admin/journal");
  revalidatePath("/journal");
  if (slug) revalidatePath(`/journal/${slug}`);
  // Category pages are dynamic segments — one call covers every one of them.
  revalidatePath("/journal/kategoria/[slug]", "page");
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export async function createJournalArticleAction(formData: FormData): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Ο τίτλος είναι υποχρεωτικός." };

  let id: string;
  try {
    id = await createJournalArticle({
      title,
      slug: text(formData.get("slug")) ?? slugify(title),
    });
    await auditLog(admin.id, "journal_article.create", "journal_article", id, { title });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidateJournal();
  // Straight into the editor — creating an article is never the goal, writing
  // it is. Throws NEXT_REDIRECT, so nothing after this runs.
  redirect(`/admin/journal/${id}`);
}

export async function saveJournalArticleAction(id: string, formData: FormData): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Ο τίτλος είναι υποχρεωτικός." };

  const status: JournalStatus = formData.get("status") === "published" ? "published" : "draft";

  // A calendar date, never a JS Date: <input type="date"> submits
  // "YYYY-MM-DD" with no timezone, and `new Date("2026-08-20")` would read it
  // as UTC midnight — which is the previous evening in Greece. The string is
  // validated here and converted to a real instant by Postgres, which knows
  // about Greek DST (see updateJournalArticle).
  const publishedDate = text(formData.get("publishedDate"));
  if (publishedDate && !isCalendarDate(publishedDate)) {
    return { ok: false, error: "Η ημερομηνία δημοσίευσης δεν είναι έγκυρη." };
  }

  const slug = text(formData.get("slug")) ?? slugify(title);

  try {
    await updateJournalArticle(id, {
      title,
      slug,
      excerpt: text(formData.get("excerpt")),
      body: text(formData.get("body")),
      categoryId: text(formData.get("categoryId")),
      heroImagePath: text(formData.get("heroImagePath")),
      heroImageAlt: text(formData.get("heroImageAlt")),
      author: text(formData.get("author")),
      status,
      publishedDate,
      isFeatured: formData.get("isFeatured") === "on",
      relatedProductSlugs: slugList(formData.get("relatedProductSlugs")),
      seo: {
        seoTitle: text(formData.get("seoTitle")),
        metaDescription: text(formData.get("metaDescription")),
        canonicalUrl: text(formData.get("canonicalUrl")),
        ogTitle: text(formData.get("ogTitle")),
        ogDescription: text(formData.get("ogDescription")),
        socialImagePath: text(formData.get("socialImagePath")),
        keywords: text(formData.get("keywords")),
        robots: formData.get("robots") === "noindex" ? "noindex" : "index",
      },
    });
    await auditLog(admin.id, "journal_article.update", "journal_article", id, { title, status });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidateJournal(slug);
  revalidatePath(`/admin/journal/${id}`);
  return {
    ok: true,
    message: status === "published" ? "Το άρθρο αποθηκεύτηκε και είναι δημοσιευμένο." : "Το άρθρο αποθηκεύτηκε ως πρόχειρο.",
  };
}

export async function setJournalArticleStatusAction(
  id: string,
  status: JournalStatus,
  slug: string
): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;
  try {
    await setJournalArticleStatus(id, status);
    await auditLog(admin.id, `journal_article.${status}`, "journal_article", id);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidateJournal(slug);
  return {
    ok: true,
    message: status === "published" ? "Το άρθρο δημοσιεύτηκε." : "Το άρθρο αποσύρθηκε.",
  };
}

export async function deleteJournalArticleAction(id: string, slug: string): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;
  try {
    await deleteJournalArticle(id);
    await auditLog(admin.id, "journal_article.delete", "journal_article", id);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidateJournal(slug);
  return { ok: true, message: "Το άρθρο διαγράφηκε." };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function saveJournalCategoryAction(formData: FormData): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Το όνομα είναι υποχρεωτικό." };
  const id = text(formData.get("id")) ?? undefined;

  try {
    const savedId = await saveJournalCategory({
      id,
      name,
      slug: text(formData.get("slug")) ?? slugify(name),
      description: text(formData.get("description")),
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
    });
    await auditLog(
      admin.id,
      id ? "journal_category.update" : "journal_category.create",
      "journal_category",
      savedId,
      { name }
    );
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidateJournal();
  revalidatePath("/admin/journal/categories");
  return { ok: true, message: id ? "Η κατηγορία ενημερώθηκε." : "Η κατηγορία δημιουργήθηκε." };
}

export async function deleteJournalCategoryAction(id: string): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;
  try {
    await deleteJournalCategory(id);
    await auditLog(admin.id, "journal_category.delete", "journal_category", id);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidateJournal();
  revalidatePath("/admin/journal/categories");
  return { ok: true, message: "Η κατηγορία διαγράφηκε. Τα άρθρα της παραμένουν, χωρίς κατηγορία." };
}
