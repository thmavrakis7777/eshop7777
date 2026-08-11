import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SEO_MODULE } from "../../../modules/seo"
import type { SeoServiceMethods } from "../../../modules/seo/service"
import { upsertSeoWorkflow } from "../../../workflows/seo/upsert-seo"

const RESOURCE_TYPES = ["product", "category", "homepage"] as const
type ResourceType = (typeof RESOURCE_TYPES)[number]

function isResourceType(value: unknown): value is ResourceType {
  return typeof value === "string" && (RESOURCE_TYPES as readonly string[]).includes(value)
}

// Single shared admin route for every SEO-managed resource type (product,
// category, homepage) — one model/service/route instead of one per entity,
// since the field set and CRUD shape are identical. The widget for each
// resource type just passes its own resource_type/resource_id.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { resource_type, resource_id } = req.query as Record<string, string | undefined>
  if (!isResourceType(resource_type) || !resource_id) {
    res.status(400).json({ message: "resource_type and resource_id are required" })
    return
  }

  const seoModuleService = req.scope.resolve<SeoServiceMethods>(SEO_MODULE)
  const [seo] = await seoModuleService.listSeos({ resource_type, resource_id })
  res.json({ seo: seo ?? null })
}

type SeoUpsertBody = {
  resource_type?: string
  resource_id?: string
  seo_title?: string | null
  meta_description?: string | null
  canonical_url?: string | null
  og_title?: string | null
  og_description?: string | null
  social_image_url?: string | null
  keywords?: string | null
  robots?: "index" | "noindex"
  structured_data_override?: Record<string, unknown> | null
}

export async function POST(req: MedusaRequest<SeoUpsertBody>, res: MedusaResponse) {
  const { resource_type, resource_id, ...fields } = req.body

  if (!isResourceType(resource_type) || !resource_id) {
    res.status(400).json({ message: "resource_type and resource_id are required" })
    return
  }

  const { result: seo } = await upsertSeoWorkflow(req.scope).run({
    input: { resource_type, resource_id, ...fields },
  })

  res.json({ seo })
}
