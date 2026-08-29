import "server-only";

/**
 * AI provider abstraction for the admin's "Generate SEO + GEO" tool
 * (lib/admin/ai-seo-actions.ts). One interface, one implementation today
 * (lib/ai/gemini-provider.ts) — deliberately thin, not a plugin system:
 * adding a second provider later is a second file implementing this same
 * interface plus one line in lib/ai/index.ts, not a rewrite.
 */

/**
 * What kind of page this generation is for — changes only the prompt's own
 * framing (gemini-provider.ts), never the request/response shape. Optional,
 * defaults to "product" (gemini-provider.ts's ALL_FIELDS default and every
 * existing product call site never sets this), so the product SEO-GEO
 * workflow is byte-for-byte unchanged. "category" exists so a category's
 * generated copy reads like a listing page ("browse our cookware") rather
 * than a single item ("this pan features...") — the previous prompt had no
 * way to say that.
 */
export type SeoSubjectType = "product" | "category";

export type SeoGenerationInput = {
  title: string;
  description: string | null;
  sku: string | null;
  categoryName: string | null;
  parentCategoryName: string | null;
  collectionTitles: string[];
  material: string | null;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  originCountry: string | null;
  // Free-text variant title — the only place color/size ever show up today
  // (no dedicated columns exist, confirmed against the schema).
  variantTitle: string | null;
  priceCents: number | null;
  // The admin's own few words of context (never the final copy — see the
  // system prompt in gemini-provider.ts for why).
  adminNotes: string | null;
  existingSlug: string;
  // Gates the UI's "changing this breaks links" warning — never gates
  // generation itself.
  isPublished: boolean;
  subjectType?: SeoSubjectType;
};

export type SeoField = "description" | "seoTitle" | "metaDescription" | "h1" | "slug" | "imageAlt";

export type SeoGenerationResult = {
  description: string;
  seoTitle: string;
  metaDescription: string;
  h1: string;
  slug: string;
  imageAlt: string;
};

export interface AIProvider {
  /**
   * `fields` limits generation to a subset (single-field regenerate) —
   * omitted means all six. The provider still returns the full
   * `SeoGenerationResult` shape; callers only persist the fields they asked
   * for, but having every field named removes ambiguity about what a
   * partial response means.
   */
  generateSeoContent(input: SeoGenerationInput, fields?: SeoField[]): Promise<SeoGenerationResult>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "not_configured" | "request_failed" | "invalid_response"
  ) {
    super(message);
  }
}
