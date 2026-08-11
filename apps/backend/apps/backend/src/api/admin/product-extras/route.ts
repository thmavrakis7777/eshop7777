import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_EXTRA_MODULE } from "../../../modules/product-extras"
import type { ProductExtraServiceMethods } from "../../../modules/product-extras/service"
import { upsertProductExtraWorkflow, type UpsertProductExtraInput } from "../../../workflows/product-extras/upsert-product-extra"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { product_id } = req.query as Record<string, string | undefined>
  if (!product_id) {
    res.status(400).json({ message: "product_id is required" })
    return
  }

  const service = req.scope.resolve<ProductExtraServiceMethods>(PRODUCT_EXTRA_MODULE)
  const [extra] = await service.listProductExtras({ product_id })
  res.json({ extra: extra ?? null })
}

export async function POST(req: MedusaRequest<UpsertProductExtraInput>, res: MedusaResponse) {
  if (!req.body.product_id) {
    res.status(400).json({ message: "product_id is required" })
    return
  }

  const { result: extra } = await upsertProductExtraWorkflow(req.scope).run({
    input: req.body,
  })
  res.json({ extra })
}
