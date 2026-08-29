"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, auditLog } from "@/lib/admin/auth";
import { checkRateLimit, rateLimitKey } from "@/lib/auth/session";
import { listCategorySeo, getCategorySeoState, saveCategorySeo } from "@/lib/admin/cms";
import { updateCategoryDescription } from "@/lib/admin/taxonomy";
import { CATEGORY_CACHE_TAG } from "@/lib/data/categories";
import { CACHE_TAGS } from "@/lib/db/content";
import { getAIProvider, AIProviderError, type SeoField, type SeoGenerationResult } from "@/lib/ai";
import { validateGeneratedContent, validateField, checkNotVerbatimCopy } from "@/lib/ai/validate-seo-content";

/**
 * Server Actions for the SEO Management page's category "SEO-GEO" button
 * (components/admin/CategoryAiSeoGenerator.tsx). Deliberately a sibling of
 * lib/admin/ai-seo-actions.ts (the product version), not an extension of it
 * — the product file's exports, types and behaviour are untouched by this
 * one. Both call the exact same `getAIProvider()` singleton and the exact
 * same validation helpers; the only thing category generation adds is
 * `subjectType: "category"` on the input, which gemini-provider.ts uses to
 * frame the prompt as a listing page instead of a single product (see its
 * own comment for why that distinction is not cosmetic).
 *
 * Only 3 of the 6 SeoField values ever apply to a category in this schema:
 * `description` (shop.category.description, the same field the storefront
 * category page already renders as long-form copy), `seoTitle` and
 * `metaDescription` (shop.seo_meta, exactly like the existing manual
 * "Επεξεργασία" form on this same page). `h1`/`slug`/`imageAlt` are
 * deliberately never requested — a category's H1 is just its name, its slug
 * has its own dedicated edit flow (with the redirect implications that
 * needs, unlike a fresh AI suggestion), and there is no per-category image
 * alt-text column in this schema.
 */

const CATEGORY_FIELDS: SeoField[] = ["description", "seoTitle", "metaDescription"];

export type GenerateResult = { ok: true; content: SeoGenerationResult } | { ok: false; error: string };

function mapAiError(err: unknown): string {
  if (err instanceof AIProviderError) {
    switch (err.code) {
      case "not_configured":
        return "Η δημιουργία περιεχομένου με AI δεν έχει ρυθμιστεί (λείπει το GEMINI_API_KEY).";
      case "invalid_response":
        return "Το AI επέστρεψε μη έγκυρη απάντηση. Δοκίμασε ξανά.";
      case "request_failed":
        return "Η κλήση στο AI απέτυχε. Δοκίμασε ξανά.";
    }
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}

/**
 * One `listCategorySeo()` call covers everything a category generation
 * needs: the target row itself (name/description/existing SEO/robots) and,
 * via every row's `parentId`, its ancestor chain — no separate tree query.
 */
async function buildInput(categoryId: string, adminNotes: string | undefined) {
  const rows = await listCategorySeo();
  const byId = new Map(rows.map((r) => [r.resourceId, r]));
  const category = byId.get(categoryId);
  if (!category) return null;

  const parent = category.parentId ? byId.get(category.parentId) : undefined;
  const grandparent = parent?.parentId ? byId.get(parent.parentId) : undefined;

  return {
    row: category,
    input: {
      title: category.label,
      description: category.description,
      sku: null,
      categoryName: parent?.label ?? null,
      parentCategoryName: grandparent?.label ?? null,
      collectionTitles: [] as string[],
      material: null,
      weightGrams: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      originCountry: null,
      variantTitle: null,
      priceCents: null,
      adminNotes: adminNotes?.trim() || null,
      existingSlug: category.slug,
      isPublished: category.isActive,
      subjectType: "category" as const,
    },
  };
}

/** Own rate-limit bucket — a runaway category-generation loop must not eat into the product one's budget, or vice versa. */
async function guardRate(): Promise<string | null> {
  if (!(await checkRateLimit(await rateLimitKey("ai-seo-generate-category"), 20, 3600))) {
    return "Πάρα πολλές κλήσεις AI. Δοκίμασε ξανά σε λίγο.";
  }
  return null;
}

export async function generateCategorySeoContentAction(categoryId: string, adminNotes?: string): Promise<GenerateResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  const rateError = await guardRate();
  if (rateError) return { ok: false, error: rateError };

  const built = await buildInput(categoryId, adminNotes);
  if (!built) return { ok: false, error: "Δεν βρέθηκε η κατηγορία." };

  try {
    const content = await getAIProvider().generateSeoContent(built.input, CATEGORY_FIELDS);
    const check = validateGeneratedContent(content, CATEGORY_FIELDS);
    if (!check.ok) return { ok: false, error: check.error };
    const copyCheck = checkNotVerbatimCopy(content.description, [built.input.adminNotes, built.input.description]);
    if (!copyCheck.ok) return { ok: false, error: copyCheck.error };
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: mapAiError(err) };
  }
}

export async function regenerateCategoryFieldAction(
  categoryId: string,
  field: SeoField,
  adminNotes?: string
): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  if (!CATEGORY_FIELDS.includes(field)) return { ok: false, error: "Μη έγκυρο πεδίο για κατηγορία." };

  const rateError = await guardRate();
  if (rateError) return { ok: false, error: rateError };

  const built = await buildInput(categoryId, adminNotes);
  if (!built) return { ok: false, error: "Δεν βρέθηκε η κατηγορία." };

  try {
    const content = await getAIProvider().generateSeoContent(built.input, [field]);
    const check = validateField(field, content[field]);
    if (!check.ok) return { ok: false, error: check.error };
    if (field === "description") {
      const copyCheck = checkNotVerbatimCopy(content.description, [built.input.adminNotes, built.input.description]);
      if (!copyCheck.ok) return { ok: false, error: copyCheck.error };
    }
    return { ok: true, value: content[field] };
  } catch (err) {
    return { ok: false, error: mapAiError(err) };
  }
}

export type SaveAiCategorySeoInput = Partial<Pick<SeoGenerationResult, "description" | "seoTitle" | "metaDescription">>;
export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveCategoryAiSeoContentAction(
  categoryId: string,
  fields: SaveAiCategorySeoInput
): Promise<SaveResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  const providedFields = (Object.keys(fields) as SeoField[]).filter((f) => fields[f as keyof SaveAiCategorySeoInput] !== undefined);
  for (const field of providedFields) {
    const check = validateField(field, fields[field as keyof SaveAiCategorySeoInput]!);
    if (!check.ok) return { ok: false, error: check.error };
  }

  // Everything that can fail — including the lookup — lives inside this one
  // try/catch, so a transient DB hiccup here surfaces as a real error
  // instead of silently skipping the write (the actual bug this fixed:
  // this lookup used to run un-guarded via the much heavier
  // listCategorySeo(), before the try/catch even started).
  try {
    const current = await getCategorySeoState(categoryId);
    if (!current) return { ok: false, error: "Δεν βρέθηκε η κατηγορία." };

    if (fields.description !== undefined) {
      await updateCategoryDescription(categoryId, fields.description);
    }
    if (fields.seoTitle !== undefined || fields.metaDescription !== undefined) {
      // Never touches robots, keywords, or the social/Open Graph fields —
      // those stay whatever the manual editor last set them to; AI
      // generation only ever covers description/seoTitle/metaDescription.
      await saveCategorySeo(categoryId, {
        seoTitle: fields.seoTitle ?? current.seoTitle,
        metaDescription: fields.metaDescription ?? current.metaDescription,
        keywords: current.keywords,
        ogTitle: current.ogTitle,
        ogDescription: current.ogDescription,
        robots: current.robots,
      });
    }
    await auditLog(admin.id, "category.ai_seo_save", "category", categoryId, { fields: providedFields });
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/admin/content/seo");
  revalidatePath("/", "layout");
  updateTag(CACHE_TAGS.seo);
  updateTag(CATEGORY_CACHE_TAG);

  return { ok: true };
}
