import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SEO_MODULE } from "../../../modules/seo"
import type { SeoServiceMethods } from "../../../modules/seo/service"

const RESOURCE_TYPES = ["product", "category", "homepage"] as const
type ResourceType = (typeof RESOURCE_TYPES)[number]

function isResourceType(value: unknown): value is ResourceType {
  return typeof value === "string" && (RESOURCE_TYPES as readonly string[]).includes(value)
}

// Read-only counterpart to /admin/seo — same public visibility as the
// product/category/homepage content itself, no auth needed (the storefront
// already calls this the same way it calls every other /store/* endpoint,
// behind the publishable-key middleware Medusa applies to this whole tree).
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
