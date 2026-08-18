"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, auditLog } from "@/lib/admin/auth";
import {
  CatalogError,
  adjustStock,
  bulkAddToCollection,
  bulkAdjustPrice,
  bulkArchive,
  bulkSetActive,
  bulkSetCategory,
  bulkSetStock,
  createProduct,
  deleteVariant,
  listProducts,
  saveVariant,
  slugify,
  updateProduct,
} from "@/lib/admin/products";
import { SEARCH_CACHE_TAG } from "@/lib/db/catalog";

/**
 * Every action here calls requireAdmin() FIRST, before reading its arguments.
 * A Server Action is a public HTTP endpoint that middleware never sees, so
 * the session check cannot live anywhere else.
 */

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export type ProductPickerHit = { slug: string; title: string; categoryName: string | null };

/**
 * Product search for admin pickers (currently the homepage rail's manual
 * product selection). Returns only what a picker row shows — never the full
 * admin product payload — so it stays a cheap keystroke-rate call.
 */
export async function searchProductsForPickerAction(query: string): Promise<ProductPickerHit[]> {
  try {
    await requireAdmin();
  } catch {
    return [];
  }
  const { products } = await listProducts({ q: query.trim() || undefined, perPage: 10 });
  return products.map((p) => ({
    slug: p.slug,
    title: p.title,
    categoryName: p.categoryName,
  }));
}

/** Resolves stored slugs back to titles so a saved picker shows real names. */
export async function resolveProductTitlesAction(slugs: string[]): Promise<ProductPickerHit[]> {
  try {
    await requireAdmin();
  } catch {
    return [];
  }
  if (slugs.length === 0) return [];
  const { products } = await listProducts({ perPage: 100 });
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  // Preserve the caller's order — it's the display order the owner chose.
  return slugs.flatMap((slug) => {
    const p = bySlug.get(slug);
    return p ? [{ slug: p.slug, title: p.title, categoryName: p.categoryName }] : [];
  });
}

function mapError(err: unknown): string {
  if (err instanceof CatalogError) {
    switch (err.code) {
      case "duplicate_slug": return "Υπάρχει ήδη προϊόν με αυτό το slug.";
      case "duplicate_sku": return "Υπάρχει ήδη προϊόν με αυτόν τον κωδικό (SKU).";
      case "last_variant": return "Δεν μπορείς να διαγράψεις τη μοναδική παραλλαγή ενός προϊόντος.";
      case "not_found": return "Δεν βρέθηκε.";
    }
  }
  if (err instanceof Error && err.message === "Not authenticated") {
    return "Η συνεδρία σου έληξε. Συνδέσου ξανά.";
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}

// Prices arrive as "24,90" or "24.90" — Greek keyboards produce a comma.
// Parsed to cents here so no rounding happens more than once.
const priceToCents = (value: FormDataEntryValue | null): number => {
  const raw = String(value ?? "").replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const optionalPriceToCents = (value: FormDataEntryValue | null): number | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return priceToCents(value);
};

const optionalText = (value: FormDataEntryValue | null): string | null => {
  const s = String(value ?? "").trim();
  return s.length > 0 ? s : null;
};

const optionalNumber = (value: FormDataEntryValue | null): number | null => {
  const s = String(value ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

const SHIPPING_CLASSES = ["standard", "heavy", "large", "custom"] as const;
type ShippingClass = (typeof SHIPPING_CLASSES)[number];

/** Anything not in the allowed set falls back to standard, never to a surcharge. */
const parseShippingClass = (value: FormDataEntryValue | null): ShippingClass => {
  const s = String(value ?? "standard");
  return (SHIPPING_CLASSES as readonly string[]).includes(s) ? (s as ShippingClass) : "standard";
};

/** Euros ("12", "12,50") to cents, or null when blank/unparseable. */
const optionalCents = optionalPriceToCents;

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

const productSchema = z.object({
  title: z.string().trim().min(1, "Ο τίτλος είναι υποχρεωτικός."),
  slug: z.string().trim().min(1, "Το slug είναι υποχρεωτικό.")
    .regex(/^[a-z0-9-]+$/, "Το slug επιτρέπει μόνο πεζά λατινικά, αριθμούς και παύλες."),
});

export async function saveProductAction(productId: string, formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  const parsed = productSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await updateProduct(productId, {
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: optionalText(formData.get("description")),
      categoryId: optionalText(formData.get("categoryId")),
      isActive: formData.get("isActive") === "on",
      isNewOverride: formData.get("isNewOverride") === "on",
      material: optionalText(formData.get("material")),
      weightGrams: optionalNumber(formData.get("weightGrams")),
      lengthCm: optionalNumber(formData.get("lengthCm")),
      widthCm: optionalNumber(formData.get("widthCm")),
      heightCm: optionalNumber(formData.get("heightCm")),
      originCountry: optionalText(formData.get("originCountry")),
      // Shipping is money the customer gets charged, so neither field is
      // trusted: the class is checked against the allowed set, and the cost is
      // clamped non-negative. A class other than "standard" with no cost
      // entered stays NULL and simply ships at the standard rate — the label
      // never silently invents a surcharge.
      shippingClass: parseShippingClass(formData.get("shippingClass")),
      shippingCostCents: (() => {
        if (parseShippingClass(formData.get("shippingClass")) === "standard") return null;
        const cents = optionalCents(formData.get("shippingCost"));
        return cents == null ? null : Math.max(0, cents);
      })(),
      badgeLabel: optionalText(formData.get("badgeLabel")),
      badgeTone: (formData.get("badgeTone") as "accent" | "success" | "neutral") ?? "neutral",
      warrantyText: optionalText(formData.get("warrantyText")),
      downloadsUrl: optionalText(formData.get("downloadsUrl")),
      hideFromSearch: formData.get("hideFromSearch") === "on",
      isSearchBoosted: formData.get("isSearchBoosted") === "on",
      collectionIds: formData.getAll("collectionIds").map(String).filter(Boolean),
      seo: {
        seoTitle: optionalText(formData.get("seoTitle")),
        metaDescription: optionalText(formData.get("metaDescription")),
        ogTitle: optionalText(formData.get("ogTitle")),
        ogDescription: optionalText(formData.get("ogDescription")),
        keywords: optionalText(formData.get("keywords")),
        robots: formData.get("robots") === "noindex" ? "noindex" : "index",
      },
    });
    await auditLog(admin.id, "product.update", "product", productId, { title: parsed.data.title });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  // Both the admin view and the public product page must reflect the change.
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/proionta/${parsed.data.slug}`, "page");
  revalidatePath("/", "layout");
  // title/slug/hideFromSearch/isSearchBoosted all feed the search index.
  updateTag(SEARCH_CACHE_TAG);
  return { ok: true, message: "Οι αλλαγές αποθηκεύτηκαν." };
}

const newProductSchema = z.object({
  title: z.string().trim().min(1, "Ο τίτλος είναι υποχρεωτικός."),
  sku: z.string().trim().min(1, "Ο κωδικός (SKU) είναι υποχρεωτικός."),
});

export async function createProductAction(formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  const parsed = newProductSchema.safeParse({
    title: formData.get("title"),
    sku: formData.get("sku"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const slugInput = optionalText(formData.get("slug"));
  let id: string;
  try {
    id = await createProduct({
      title: parsed.data.title,
      slug: slugInput ?? slugify(parsed.data.title),
      sku: parsed.data.sku.toUpperCase(),
      priceCents: priceToCents(formData.get("price")),
      stockQuantity: Number(formData.get("stock") ?? 0) || 0,
      categoryId: optionalText(formData.get("categoryId")),
    });
    await auditLog(admin.id, "product.create", "product", id, { title: parsed.data.title });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidatePath("/admin/products");
  updateTag(SEARCH_CACHE_TAG);
  // New products start inactive, so the operator lands in the editor to
  // finish them rather than back on a list where nothing looks different.
  redirect(`/admin/products/${id}`);
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export async function saveVariantAction(productId: string, formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  if (!sku) return { ok: false, error: "Ο κωδικός (SKU) είναι υποχρεωτικός." };

  const priceCents = priceToCents(formData.get("price"));
  const compareAt = optionalPriceToCents(formData.get("compareAtPrice"));
  // A "sale" price that isn't lower than the original is not a sale — reject
  // it rather than render a -0% badge on the storefront.
  if (compareAt != null && compareAt <= priceCents) {
    return { ok: false, error: "Η αρχική τιμή πρέπει να είναι μεγαλύτερη από την τιμή πώλησης." };
  }

  try {
    await saveVariant(productId, {
      id: optionalText(formData.get("variantId")) ?? undefined,
      sku,
      title: optionalText(formData.get("variantTitle")) ?? "Default",
      priceCents,
      compareAtPriceCents: compareAt,
      stockQuantity: Number(formData.get("stock") ?? 0) || 0,
      allowBackorder: formData.get("allowBackorder") === "on",
      isActive: formData.get("variantActive") !== "off",
    });
    await auditLog(admin.id, "variant.save", "product", productId, { sku });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/", "layout");
  // sku feeds the search index (buildSearchIndexEntry indexes variant SKUs).
  updateTag(SEARCH_CACHE_TAG);
  return { ok: true, message: "Η παραλλαγή αποθηκεύτηκε." };
}

export async function deleteVariantAction(productId: string, variantId: string): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  try {
    await deleteVariant(productId, variantId);
    await auditLog(admin.id, "variant.delete", "product", productId, { variantId });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath(`/admin/products/${productId}`);
  updateTag(SEARCH_CACHE_TAG);
  return { ok: true, message: "Η παραλλαγή διαγράφηκε." };
}

export async function adjustStockAction(variantId: string, quantity: number): Promise<ActionResult> {
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
    await adjustStock(variantId, quantity, admin.id);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
  return { ok: true, message: "Το απόθεμα ενημερώθηκε." };
}

// ---------------------------------------------------------------------------
// Bulk
// ---------------------------------------------------------------------------

export type BulkOperation =
  | { kind: "activate" }
  | { kind: "deactivate" }
  | { kind: "category"; categoryId: string | null }
  | { kind: "collection"; collectionId: string }
  | { kind: "price"; mode: "percent" | "fixed"; value: number }
  | { kind: "stock"; quantity: number }
  | { kind: "archive" };

export async function bulkProductAction(ids: string[], op: BulkOperation): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  if (ids.length === 0) return { ok: false, error: "Δεν έχεις επιλέξει προϊόντα." };

  try {
    let message: string;
    switch (op.kind) {
      case "activate": {
        const { affected } = await bulkSetActive(ids, true);
        message = `${affected} προϊόντα ενεργοποιήθηκαν.`;
        break;
      }
      case "deactivate": {
        const { affected } = await bulkSetActive(ids, false);
        message = `${affected} προϊόντα απενεργοποιήθηκαν.`;
        break;
      }
      case "category": {
        const { affected } = await bulkSetCategory(ids, op.categoryId);
        message = `${affected} προϊόντα άλλαξαν κατηγορία.`;
        break;
      }
      case "collection": {
        const { affected } = await bulkAddToCollection(ids, op.collectionId);
        message = `${affected} προϊόντα προστέθηκαν στη συλλογή.`;
        break;
      }
      case "price": {
        const { affected } = await bulkAdjustPrice(ids, op.mode, op.value);
        message = `Ενημερώθηκαν οι τιμές σε ${affected} παραλλαγές.`;
        break;
      }
      case "stock": {
        const { affected } = await bulkSetStock(ids, op.quantity, admin.id);
        message = `Ενημερώθηκε το απόθεμα σε ${affected} παραλλαγές.`;
        break;
      }
      case "archive": {
        const { deleted, deactivated } = await bulkArchive(ids);
        message =
          deactivated > 0
            ? `${deleted} διαγράφηκαν, ${deactivated} απενεργοποιήθηκαν (έχουν παραγγελίες).`
            : `${deleted} προϊόντα διαγράφηκαν.`;
        break;
      }
    }
    await auditLog(admin.id, `product.bulk.${op.kind}`, "product", ids.join(","), { count: ids.length });
    revalidatePath("/admin/products");
    revalidatePath("/", "layout");
    // activate/deactivate/archive all change search-index membership; the
    // others are harmless no-ops for search, but a bulk op runs rarely
    // enough that invalidating unconditionally isn't worth branching on.
    updateTag(SEARCH_CACHE_TAG);
    return { ok: true, message };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
