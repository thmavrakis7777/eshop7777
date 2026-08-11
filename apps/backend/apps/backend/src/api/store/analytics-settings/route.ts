import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ANALYTICS_SETTINGS_MODULE } from "../../../modules/analytics-settings"
import type { AnalyticsSettingsServiceMethods } from "../../../modules/analytics-settings/service"

// Read-only counterpart to /admin/analytics-settings. No publish flag here
// (unlike promo-banner) — an analytics ID is either configured or it
// isn't, there's no draft state to hide; the consent banner and script
// injection are what actually gate whether anything loads.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AnalyticsSettingsServiceMethods>(ANALYTICS_SETTINGS_MODULE)
  const [settings] = await service.listAnalyticsSettings()
  res.json({ settings: settings ?? null })
}
