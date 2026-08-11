import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONTENT_PAGE_MODULE } from "../../../modules/content-pages"
import type { ContentPageServiceMethods } from "../../../modules/content-pages/service"

// Public counterpart to /admin/content-pages — deliberately returns null
// for both "doesn't exist" and "exists but not published", so a draft
// page's content is never exposed through the public Store API, the same
// way a real CMS wouldn't leak unpublished content through its public
// endpoints.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { slug } = req.query as Record<string, string | undefined>
  if (!slug) {
    res.status(400).json({ message: "slug is required" })
    return
  }

  const contentPageModuleService = req.scope.resolve<ContentPageServiceMethods>(CONTENT_PAGE_MODULE)
  const [page] = await contentPageModuleService.listContentPages({ slug })
  res.json({ page: page && page.is_published ? page : null })
}
