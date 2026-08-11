import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_EXTRA_MODULE } from "../../../modules/product-extras"
import type { ProductExtraServiceMethods } from "../../../modules/product-extras/service"

// Read-only counterpart to /admin/product-extras — same public visibility
// as the product itself, no auth needed (same pattern as /store/seo).
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
