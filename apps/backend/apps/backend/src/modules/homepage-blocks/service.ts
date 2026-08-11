import { MedusaService } from "@medusajs/framework/utils"
import HomepageBlock from "./models/homepage-block"

class HomepageBlockModuleService extends MedusaService({
  HomepageBlock,
}) {}

// "homepage_block" pluralizes to "homepage_blocks" by the regular rule —
// verified live via `medusa exec` anyway before trusting this, standing
// practice since the seo module's Seo/Seoes bug.
export interface HomepageBlockRecord {
  id: string
  kind: "hero" | "promo"
  eyebrow: string | null
  heading: string | null
  body: string | null
  cta_label: string | null
  cta_href: string | null
  image_url: string | null
  sort_order: number
  is_published: boolean
}

export interface HomepageBlockServiceMethods {
  listHomepageBlocks(
    filters: Partial<Pick<HomepageBlockRecord, "kind" | "id" | "is_published">>,
    config?: { order?: Record<string, "ASC" | "DESC"> }
  ): Promise<HomepageBlockRecord[]>
  createHomepageBlocks(data: Partial<HomepageBlockRecord> & Pick<HomepageBlockRecord, "kind">): Promise<HomepageBlockRecord>
  updateHomepageBlocks(data: Partial<HomepageBlockRecord> & Pick<HomepageBlockRecord, "id">): Promise<HomepageBlockRecord>
  deleteHomepageBlocks(id: string): Promise<void>
}

export default HomepageBlockModuleService
