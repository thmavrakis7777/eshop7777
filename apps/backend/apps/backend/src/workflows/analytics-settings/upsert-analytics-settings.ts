import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ANALYTICS_SETTINGS_MODULE } from "../../modules/analytics-settings"
import type { AnalyticsSettingsServiceMethods } from "../../modules/analytics-settings/service"

export type UpsertAnalyticsSettingsInput = {
  ga4_measurement_id?: string | null
  gtm_container_id?: string | null
  meta_pixel_id?: string | null
  clarity_project_id?: string | null
}

// Same list-then-create-or-update shape as site-settings/promo-banner —
// there's only ever one row.
const upsertAnalyticsSettingsStep = createStep(
  "upsert-analytics-settings",
  async (input: UpsertAnalyticsSettingsInput, { container }) => {
    const service = container.resolve<AnalyticsSettingsServiceMethods>(ANALYTICS_SETTINGS_MODULE)

    const [existing] = await service.listAnalyticsSettings()

    const settings = existing
      ? await service.updateAnalyticsSettings({ id: existing.id, ...input })
      : await service.createAnalyticsSettings(input)

    return new StepResponse(settings, settings.id)
  }
)

export const upsertAnalyticsSettingsWorkflow = createWorkflow(
  "upsert-analytics-settings",
  (input: UpsertAnalyticsSettingsInput) => {
    const settings = upsertAnalyticsSettingsStep(input)
    return new WorkflowResponse(settings)
  }
)
