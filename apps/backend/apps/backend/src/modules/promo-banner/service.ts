import { MedusaService } from "@medusajs/framework/utils"
import PromoBanner from "./models/promo-banner"

class PromoBannerModuleService extends MedusaService({
  PromoBanner,
}) {}

// "promo_banner" pluralizes to "promo_banners" by the regular rule —
// verified live via `medusa exec` anyway before trusting this, standing
// practice since the seo module's Seo/Seoes bug.
export interface PromoBannerRecord {
  id: string
  headline: string | null
  body: string | null
  cta_label: string | null
  cta_href: string | null
  ends_at: string | null
  is_published: boolean
}

export interface PromoBannerServiceMethods {
  listPromoBanners(filters?: Record<string, never>): Promise<PromoBannerRecord[]>
  createPromoBanners(data: Partial<PromoBannerRecord>): Promise<PromoBannerRecord>
  updatePromoBanners(data: Partial<PromoBannerRecord> & Pick<PromoBannerRecord, "id">): Promise<PromoBannerRecord>
}

export default PromoBannerModuleService
