import { MedusaService } from "@medusajs/framework/utils"
import ContentPage from "./models/content-page"

class ContentPageModuleService extends MedusaService({
  ContentPage,
}) {}

// "content_page" pluralizes to "content_pages" by the regular rule —
// verified live via `medusa exec` anyway before trusting this, same
// standing practice since the seo module's Seo/Seoes bug (see that
// module's service.ts).
export interface ContentPageRecord {
  id: string
  slug: string
  title: string
  body: string | null
  is_published: boolean
}

export interface ContentPageServiceMethods {
  listContentPages(filters: Partial<Pick<ContentPageRecord, "slug" | "id">>): Promise<ContentPageRecord[]>
  createContentPages(data: Partial<ContentPageRecord> & Pick<ContentPageRecord, "slug" | "title">): Promise<ContentPageRecord>
  updateContentPages(data: Partial<ContentPageRecord> & Pick<ContentPageRecord, "id">): Promise<ContentPageRecord>
}

export default ContentPageModuleService
