import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONTENT_PAGE_MODULE } from "../../../modules/content-pages"
import type { ContentPageServiceMethods } from "../../../modules/content-pages/service"
import { upsertContentPageWorkflow, type UpsertContentPageInput } from "../../../workflows/content-pages/upsert-content-page"

// Looked up by slug (?slug=), same as /admin/seo's resource_id lookup —
// returns null (not 404) when the page hasn't been created yet, since an
// admin editing a not-yet-existing page is the normal first-visit case,
// not an error.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { slug } = req.query as Record<string, string | undefined>
  if (!slug) {
    res.status(400).json({ message: "slug is required" })
    return
  }

  const contentPageModuleService = req.scope.resolve<ContentPageServiceMethods>(CONTENT_PAGE_MODULE)
  const [page] = await contentPageModuleService.listContentPages({ slug })
  res.json({ page: page ?? null })
}

export async function POST(req: MedusaRequest<UpsertContentPageInput>, res: MedusaResponse) {
  const { slug } = req.body
  if (!slug) {
    res.status(400).json({ message: "slug is required" })
    return
  }

  const { result: page } = await upsertContentPageWorkflow(req.scope).run({
    input: req.body,
  })
  res.json({ page })
}
