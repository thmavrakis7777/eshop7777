import { MedusaService } from "@medusajs/framework/utils"
import ProductExtra from "./models/product-extra"

class ProductExtraModuleService extends MedusaService({
  ProductExtra,
}) {}

// "product_extra" pluralizes to "product_extras" by the regular rule —
// verified live via `medusa exec` anyway before trusting this, standing
// practice since the seo module's Seo/Seoes bug.
export interface ProductExtraRecord {
  id: string
  product_id: string
  badge_label: string | null
  badge_tone: "accent" | "success" | "neutral"
  warranty_text: string | null
  downloads_url: string | null
  hide_from_search: boolean
  is_search_boosted: boolean
}

export interface ProductExtraServiceMethods {
  listProductExtras(filters: Partial<Pick<ProductExtraRecord, "product_id" | "id">>): Promise<ProductExtraRecord[]>
  createProductExtras(data: Partial<ProductExtraRecord> & Pick<ProductExtraRecord, "product_id">): Promise<ProductExtraRecord>
  updateProductExtras(data: Partial<ProductExtraRecord> & Pick<ProductExtraRecord, "id">): Promise<ProductExtraRecord>
}

export default ProductExtraModuleService
