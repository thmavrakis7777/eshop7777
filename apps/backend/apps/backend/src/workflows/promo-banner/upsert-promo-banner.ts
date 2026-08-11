import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { PROMO_BANNER_MODULE } from "../../modules/promo-banner"
import type { PromoBannerServiceMethods } from "../../modules/promo-banner/service"

export type UpsertPromoBannerInput = {
  headline?: string | null
  body?: string | null
  cta_label?: string | null
  cta_href?: string | null
  ends_at?: string | null
  is_published?: boolean
}

// Same list-then-create-or-update shape as site-settings — there's only
// ever one row.
const upsertPromoBannerStep = createStep("upsert-promo-banner", async (input: UpsertPromoBannerInput, { container }) => {
  const service = container.resolve<PromoBannerServiceMethods>(PROMO_BANNER_MODULE)

  const [existing] = await service.listPromoBanners()

  const banner = existing
    ? await service.updatePromoBanners({ id: existing.id, ...input })
    : await service.createPromoBanners(input)

  return new StepResponse(banner, banner.id)
})

export const upsertPromoBannerWorkflow = createWorkflow("upsert-promo-banner", (input: UpsertPromoBannerInput) => {
  const banner = upsertPromoBannerStep(input)
  return new WorkflowResponse(banner)
})
