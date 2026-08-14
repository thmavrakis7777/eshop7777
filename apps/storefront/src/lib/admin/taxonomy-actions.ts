"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, auditLog } from "@/lib/admin/auth";
import {
  TaxonomyError,
  deleteCategory,
  deleteCollection,
  moveCategory,
  saveCategory,
  saveCollection,
} from "@/lib/admin/taxonomy";
import { adjustStock } from "@/lib/admin/products";
import type { ActionResult } from "@/lib/admin/catalog-actions";

function mapError(err: unknown): string {
  if (err instanceof TaxonomyError) {
    switch (err.code) {
      case "duplicate_slug": return "Υπάρχει ήδη εγγραφή με αυτό το slug.";
      case "has_children": return "Η κατηγορία έχει υποκατηγορίες. Διάγραψε ή μετακίνησέ τις πρώτα.";
      case "has_products": return "Η κατηγορία έχει προϊόντα. Μετακίνησέ τα σε άλλη κατηγορία πρώτα.";
      case "cycle": return "Μια κατηγορία δεν μπορεί να μπει μέσα στον εαυτό της.";
      case "not_found": return "Δεν βρέθηκε.";
    }
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}

const slugField = z
  .string()
  .trim()
  .min(1, "Το slug είναι υποχρεωτικό.")
  .regex(/^[a-z0-9-]+$/, "Το slug επιτρέπει μόνο πεζά λατινικά, αριθμούς και παύλες.");

const text = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : null;
};

/**
 * Category and collection changes ripple into the storefront's navigation,
 * which every page renders — so these revalidate the root layout, not just
 * the admin route.
 */
function revalidateStorefront() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().trim().min(1, "Το όνομα είναι υποχρεωτικό."),
  slug: slugField,
});

export async function saveCategoryAction(formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  const parsed = categorySchema.safeParse({ name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const id = text(formData.get("id")) ?? undefined;
  try {
    const savedId = await saveCategory({
      id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: text(formData.get("description")),
      parentId: text(formData.get("parentId")),
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
      isActive: formData.get("isActive") === "on",
    });
    await auditLog(admin.id, id ? "category.update" : "category.create", "category", savedId, {
      name: parsed.data.name,
    });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidatePath("/admin/categories");
  revalidateStorefront();
  return { ok: true, message: id ? "Η κατηγορία ενημερώθηκε." : "Η κατηγορία δημιουργήθηκε." };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  try {
    await deleteCategory(id);
    await auditLog(admin.id, "category.delete", "category", id);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin/categories");
  revalidateStorefront();
  return { ok: true, message: "Η κατηγορία διαγράφηκε." };
}

export async function moveCategoryAction(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  try {
    await moveCategory(id, direction);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin/categories");
  revalidateStorefront();
  return { ok: true };
}

// ---------------------------------------------------------------------------

const collectionSchema = z.object({
  title: z.string().trim().min(1, "Ο τίτλος είναι υποχρεωτικός."),
  slug: slugField,
});

export async function saveCollectionAction(formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  const parsed = collectionSchema.safeParse({ title: formData.get("title"), slug: formData.get("slug") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const id = text(formData.get("id")) ?? undefined;
  try {
    const savedId = await saveCollection({
      id,
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: text(formData.get("description")),
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
      isActive: formData.get("isActive") === "on",
    });
    await auditLog(admin.id, id ? "collection.update" : "collection.create", "collection", savedId, {
      title: parsed.data.title,
    });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidatePath("/admin/collections");
  revalidateStorefront();
  return { ok: true, message: id ? "Η συλλογή ενημερώθηκε." : "Η συλλογή δημιουργήθηκε." };
}

export async function deleteCollectionAction(id: string): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  try {
    await deleteCollection(id);
    await auditLog(admin.id, "collection.delete", "collection", id);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin/collections");
  revalidateStorefront();
  return { ok: true, message: "Η συλλογή διαγράφηκε." };
}

// ---------------------------------------------------------------------------

export async function setStockAction(variantId: string, quantity: number, note?: string): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { ok: false, error: "Το απόθεμα πρέπει να είναι μη αρνητικός ακέραιος." };
  }
  try {
    // Goes through adjustStock so the change is recorded as an
    // inventory_movement with the admin who made it — stock never moves
    // without an audit row.
    await adjustStock(variantId, quantity, admin.id, "manual", note);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidateStorefront();
  return { ok: true, message: "Το απόθεμα ενημερώθηκε." };
}
