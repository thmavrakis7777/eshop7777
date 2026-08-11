import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { SEO_MODULE } from "../../modules/seo"
import type { SeoServiceMethods } from "../../modules/seo/service"

export type UpsertSeoInput = {
  resource_type: "product" | "category" | "homepage"
  resource_id: string
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

// Business logic (the list-then-create-or-update decision) lives here, not
// in the API route handler, per this backend's own convention — routes
// resolve and run a workflow; workflows compose steps.
const upsertSeoStep = createStep("upsert-seo", async (input: UpsertSeoInput, { container }) => {
  const seoModuleService = container.resolve<SeoServiceMethods>(SEO_MODULE)
  const { resource_type, resource_id, ...fields } = input

  const [existing] = await seoModuleService.listSeos({ resource_type, resource_id })

  const seo = existing
    ? await seoModuleService.updateSeos({ id: existing.id, ...fields })
    : await seoModuleService.createSeos({ resource_type, resource_id, ...fields })

  return new StepResponse(seo, seo.id)
})

export const upsertSeoWorkflow = createWorkflow("upsert-seo", (input: UpsertSeoInput) => {
  const seo = upsertSeoStep(input)
  return new WorkflowResponse(seo)
})
