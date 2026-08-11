import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { CONTENT_PAGE_MODULE } from "../../modules/content-pages"
import type { ContentPageServiceMethods } from "../../modules/content-pages/service"

export type UpsertContentPageInput = {
  slug: string
  title?: string
  body?: string | null
  is_published?: boolean
}

// Looked up by slug, not id — the admin UI only ever knows the fixed set
// of slugs the storefront has a literal route for (see the content_page
// model comment), and a row may not exist yet the first time a page is
// saved, so create-or-update by slug (same shape as the seo module's
// upsert-seo) is more robust than requiring a pre-seeded id.
const upsertContentPageStep = createStep("upsert-content-page", async (input: UpsertContentPageInput, { container }) => {
  const contentPageModuleService = container.resolve<ContentPageServiceMethods>(CONTENT_PAGE_MODULE)
  const { slug, ...fields } = input

  const [existing] = await contentPageModuleService.listContentPages({ slug })

  const page = existing
    ? await contentPageModuleService.updateContentPages({ id: existing.id, ...fields })
    : await contentPageModuleService.createContentPages({ slug, title: fields.title ?? slug, ...fields })

  return new StepResponse(page, page.id)
})

export const upsertContentPageWorkflow = createWorkflow("upsert-content-page", (input: UpsertContentPageInput) => {
  const page = upsertContentPageStep(input)
  return new WorkflowResponse(page)
})
