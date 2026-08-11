import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { PRODUCT_EXTRA_MODULE } from "../../modules/product-extras"
import type { ProductExtraServiceMethods } from "../../modules/product-extras/service"

export type UpsertProductExtraInput = {
  product_id: string
  badge_label?: string | null
  badge_tone?: "accent" | "success" | "neutral"
  warranty_text?: string | null
  downloads_url?: string | null
  hide_from_search?: boolean
  is_search_boosted?: boolean
}

// Same list-then-create-or-update shape as the seo module's upsert-seo —
// looked up by the real Medusa product_id, not a pre-seeded row.
const upsertProductExtraStep = createStep("upsert-product-extra", async (input: UpsertProductExtraInput, { container }) => {
  const service = container.resolve<ProductExtraServiceMethods>(PRODUCT_EXTRA_MODULE)
  const { product_id, ...fields } = input

  const [existing] = await service.listProductExtras({ product_id })

  const extra = existing
    ? await service.updateProductExtras({ id: existing.id, ...fields })
    : await service.createProductExtras({ product_id, ...fields })

  return new StepResponse(extra, extra.id)
})

export const upsertProductExtraWorkflow = createWorkflow("upsert-product-extra", (input: UpsertProductExtraInput) => {
  const extra = upsertProductExtraStep(input)
  return new WorkflowResponse(extra)
})
