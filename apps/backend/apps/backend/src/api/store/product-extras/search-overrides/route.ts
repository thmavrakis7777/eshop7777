import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_EXTRA_MODULE } from "../../../../modules/product-extras"
import type { ProductExtraServiceMethods } from "../../../../modules/product-extras/service"

// A batch endpoint, deliberately separate from the single-product GET at
// /store/product-extras — the storefront's search catalog needs the
// hidden/boosted product ids for the *whole* catalog in one request, not
// N individual lookups per product (the exact batch-vs-per-product
// tradeoff flagged as a follow-up in Phase F's grid-listing-badge notes).
// Returns only ids, not full records — search doesn't need
// badge_label/warranty_text/etc., and a smaller payload is simply less to
// ship on every search-catalog fetch.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<ProductExtraServiceMethods>(PRODUCT_EXTRA_MODULE)
  const extras = await service.listProductExtras({})

  res.json({
    hidden: extras.filter((e) => e.hide_from_search).map((e) => e.product_id),
    boosted: extras.filter((e) => e.is_search_boosted).map((e) => e.product_id),
  })
}
