import { MedusaService } from "@medusajs/framework/utils"
import SiteSetting from "./models/site-setting"

class SiteSettingModuleService extends MedusaService({
  SiteSetting,
}) {}

// See models/site-setting.ts for why the model name is singular — regular
// pluralization means the generated runtime methods (verified live via
// `medusa exec` before trusting this, same discipline as the seo module's
// documented bug) genuinely are listSiteSettings/createSiteSettings/
// updateSiteSettings, no Seo-style mismatch here.
export interface SiteSettingRecord {
  id: string
  footer_tagline: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_address: string | null
  business_hours: string | null
  facebook_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  announcement_text: string | null
  cart_message: string | null
}

export interface SiteSettingServiceMethods {
  listSiteSettings(filters?: Record<string, never>): Promise<SiteSettingRecord[]>
  createSiteSettings(data: Partial<SiteSettingRecord>): Promise<SiteSettingRecord>
  updateSiteSettings(data: Partial<SiteSettingRecord> & Pick<SiteSettingRecord, "id">): Promise<SiteSettingRecord>
}

export default SiteSettingModuleService
