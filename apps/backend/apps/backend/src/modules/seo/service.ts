import { MedusaService } from "@medusajs/framework/utils"
import Seo from "./models/seo"

class SeoModuleService extends MedusaService({
  Seo,
}) {}

// MedusaService's generated TYPES pluralize the "seo" model name as "Seoes"
// (hero/heroes-style), but the REAL runtime methods — verified by
// inspecting the live prototype chain via `medusa exec` — are "Seos"
// (listSeos/createSeos/updateSeos/...), a plain "+s". This is a genuine
// mismatch between Medusa's compile-time and runtime pluralization for
// this specific model name, not a mistake in the calling code. Callers
// should resolve the module typed as `SeoServiceMethods` below — which
// matches what's actually callable at runtime — rather than the raw
// `SeoModuleService` class type.
export interface SeoRecord {
  id: string
  resource_type: "product" | "category" | "homepage"
  resource_id: string
  seo_title: string | null
  meta_description: string | null
  canonical_url: string | null
  og_title: string | null
  og_description: string | null
  social_image_url: string | null
  keywords: string | null
  robots: "index" | "noindex"
  structured_data_override: Record<string, unknown> | null
}

export interface SeoServiceMethods {
  listSeos(filters: Partial<Pick<SeoRecord, "resource_type" | "resource_id" | "id">>): Promise<SeoRecord[]>
  createSeos(data: Partial<SeoRecord> & Pick<SeoRecord, "resource_type" | "resource_id">): Promise<SeoRecord>
  updateSeos(data: Partial<SeoRecord> & Pick<SeoRecord, "id">): Promise<SeoRecord>
}

export default SeoModuleService
