import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SITE_SETTING_MODULE } from "../../../modules/site-settings"
import type { SiteSettingServiceMethods } from "../../../modules/site-settings/service"
import { upsertSiteSettingsWorkflow, type UpsertSiteSettingsInput } from "../../../workflows/site-settings/upsert-site-settings"

// Singleton settings — no resource_type/resource_id like /admin/seo, since
// there's exactly one row for the whole store.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const siteSettingModuleService = req.scope.resolve<SiteSettingServiceMethods>(SITE_SETTING_MODULE)
  const [settings] = await siteSettingModuleService.listSiteSettings()
  res.json({ settings: settings ?? null })
}

export async function POST(req: MedusaRequest<UpsertSiteSettingsInput>, res: MedusaResponse) {
  const { result: settings } = await upsertSiteSettingsWorkflow(req.scope).run({
    input: req.body,
  })
  res.json({ settings })
}
