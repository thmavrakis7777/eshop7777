import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROMO_BANNER_MODULE } from "../../../modules/promo-banner"
import type { PromoBannerServiceMethods } from "../../../modules/promo-banner/service"
import { upsertPromoBannerWorkflow, type UpsertPromoBannerInput } from "../../../workflows/promo-banner/upsert-promo-banner"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<PromoBannerServiceMethods>(PROMO_BANNER_MODULE)
  const [banner] = await service.listPromoBanners()
  res.json({ banner: banner ?? null })
}

export async function POST(req: MedusaRequest<UpsertPromoBannerInput>, res: MedusaResponse) {
  const { result: banner } = await upsertPromoBannerWorkflow(req.scope).run({
    input: req.body,
  })
  res.json({ banner })
}
