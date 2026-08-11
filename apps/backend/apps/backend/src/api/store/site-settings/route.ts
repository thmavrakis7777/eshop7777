import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SITE_SETTING_MODULE } from "../../../modules/site-settings"
import type { SiteSettingServiceMethods } from "../../../modules/site-settings/service"

// Read-only counterpart to /admin/site-settings — same public visibility as
// the footer/announcement content itself, no auth needed (same pattern as
// /store/seo).
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const siteSettingModuleService = req.scope.resolve<SiteSettingServiceMethods>(SITE_SETTING_MODULE)
  const [settings] = await siteSettingModuleService.listSiteSettings()
  res.json({ settings: settings ?? null })
}
