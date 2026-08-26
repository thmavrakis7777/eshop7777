"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, auditLog } from "@/lib/admin/auth";
import { checkRateLimit, rateLimitKey } from "@/lib/auth/session";
import {
  CatalogError,
  getProductForEdit,
  getProductPromptContext,
  updateProductAiSeoContent,
  updateProductImageAlt,
} from "@/lib/admin/products";
import { getAIProvider, AIProviderError, type SeoField, type SeoGenerationResult } from "@/lib/ai";
import { validateGeneratedContent, validateField, checkNotVerbatimCopy } from "@/lib/ai/validate-seo-content";
import { SEARCH_CACHE_TAG } from "@/lib/db/catalog";
import { META_FEED_CACHE_TAG } from "@/lib/db/meta-feed";

/**
 * Server Actions for the admin's "✨ Generate SEO + GEO" tool
 * (components/admin/AiSeoGenerator.tsx). Gemini is only ever called from
 * generateSeoContentAction/regenerateFieldAction — both exclusively
 * button-triggered. Nothing here runs on page load, product view, or the
 * main product form's own save.
 */

const ALL_FIELDS: SeoField[] = ["description", "seoTitle", "metaDescription", "h1", "slug", "imageAlt"];

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

async function buildInput(productId: string, adminNotes: string | undefined) {
  const product = await getProductForEdit(productId);
  if (!product) return null;
  const context = await getProductPromptContext(productId);
  const primaryVariant = product.variants[0];

  return {
    input: {
      title: product.title,
      description: product.description,
      sku: primaryVariant?.sku ?? null,
      categoryName: context.categoryName,
      parentCategoryName: context.parentCategoryName,
      collectionTitles: context.collectionTitles,
      material: product.material,
      weightGrams: product.weightGrams,
      lengthCm: product.lengthCm,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
      originCountry: product.originCountry,
      variantTitle: product.variants.length > 1 ? (primaryVariant?.title ?? null) : null,
      priceCents: primaryVariant?.priceCents ?? null,
      adminNotes: adminNotes?.trim() || null,
      existingSlug: product.slug,
      isPublished: product.isActive,
    },
    primaryImageId: product.images[0]?.id ?? null,
  };
}

/** Rate-limited per-admin — generous for real use, blocks a runaway loop. */
async function guardRate(): Promise<string | null> {
  if (!(await checkRateLimit(await rateLimitKey("ai-seo-generate"), 20, 3600))) {
    return "Πάρα πολλές κλήσεις AI. Δοκίμασε ξανά σε λίγο.";
  }
  return null;
}

export async function generateSeoContentAction(productId: string, adminNotes?: string): Promise<GenerateResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  const rateError = await guardRate();
  if (rateError) return { ok: false, error: rateError };

  const built = await buildInput(productId, adminNotes);
  if (!built) return { ok: false, error: "Δεν βρέθηκε το προϊόν." };

  try {
    const content = await getAIProvider().generateSeoContent(built.input, ALL_FIELDS);
    const check = validateGeneratedContent(content, ALL_FIELDS);
    if (!check.ok) return { ok: false, error: check.error };
    const copyCheck = checkNotVerbatimCopy(content.description, [built.input.adminNotes, built.input.description]);
    if (!copyCheck.ok) return { ok: false, error: copyCheck.error };
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: mapAiError(err) };
  }
}

export async function regenerateFieldAction(
  productId: string,
  field: SeoField,
  adminNotes?: string
): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  const rateError = await guardRate();
  if (rateError) return { ok: false, error: rateError };

  const built = await buildInput(productId, adminNotes);
  if (!built) return { ok: false, error: "Δεν βρέθηκε το προϊόν." };

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

export type SaveAiSeoInput = Partial<SeoGenerationResult>;
export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveAiSeoContentAction(productId: string, fields: SaveAiSeoInput): Promise<SaveResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  // Never trust client-sent content unchecked, even content the client
  // itself generated moments ago — the admin may have hand-edited it since.
  const providedFields = (Object.keys(fields) as SeoField[]).filter((f) => fields[f] !== undefined);
  for (const field of providedFields) {
    const check = validateField(field, fields[field]!);
    if (!check.ok) return { ok: false, error: check.error };
  }

  const built = await buildInput(productId, undefined);
  if (!built) return { ok: false, error: "Δεν βρέθηκε το προϊόν." };

  try {
    await updateProductAiSeoContent(productId, {
      title: fields.h1,
      description: fields.description,
      slug: fields.slug,
      seoTitle: fields.seoTitle,
      metaDescription: fields.metaDescription,
    });

    if (fields.imageAlt && built.primaryImageId) {
      await updateProductImageAlt(built.primaryImageId, fields.imageAlt);
    }

    await auditLog(admin.id, "product.ai_seo_save", "product", productId, { fields: providedFields });
  } catch (err) {
    if (err instanceof CatalogError) return { ok: false, error: mapCatalogError(err) };
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/", "layout");
  updateTag(SEARCH_CACHE_TAG);
  updateTag(META_FEED_CACHE_TAG);

  return { ok: true };
}

function mapCatalogError(err: CatalogError): string {
  switch (err.code) {
    case "duplicate_slug":
      return "Υπάρχει ήδη προϊόν με αυτό το slug.";
    case "not_found":
      return "Δεν βρέθηκε.";
    default:
      return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
  }
}
