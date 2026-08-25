import "server-only";
import type { AIProvider } from "@/lib/ai/provider";
import { GeminiProvider } from "@/lib/ai/gemini-provider";

export type { AIProvider, SeoField, SeoGenerationInput, SeoGenerationResult } from "@/lib/ai/provider";
export { AIProviderError } from "@/lib/ai/provider";

/**
 * The one place a caller asks for "the AI provider" rather than importing
 * GeminiProvider directly — swapping providers later is a new file
 * implementing AIProvider plus a branch here, not a rewrite of every call
 * site. No env-driven multi-provider switch built yet (only one provider
 * exists) — deliberately not over-engineered ahead of actually needing it.
 */
export function getAIProvider(): AIProvider {
  return new GeminiProvider();
}
