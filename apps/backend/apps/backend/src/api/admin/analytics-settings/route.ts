import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ANALYTICS_SETTINGS_MODULE } from "../../../modules/analytics-settings"
import type { AnalyticsSettingsServiceMethods } from "../../../modules/analytics-settings/service"
import {
  upsertAnalyticsSettingsWorkflow,
  type UpsertAnalyticsSettingsInput,
} from "../../../workflows/analytics-settings/upsert-analytics-settings"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AnalyticsSettingsServiceMethods>(ANALYTICS_SETTINGS_MODULE)
  const [settings] = await service.listAnalyticsSettings()
  res.json({ settings: settings ?? null })
}

export async function POST(req: MedusaRequest<UpsertAnalyticsSettingsInput>, res: MedusaResponse) {
  const { result: settings } = await upsertAnalyticsSettingsWorkflow(req.scope).run({
    input: req.body,
  })
  res.json({ settings })
}
