import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { SITE_SETTING_MODULE } from "../../modules/site-settings"
import type { SiteSettingServiceMethods } from "../../modules/site-settings/service"

export type UpsertSiteSettingsInput = {
  footer_tagline?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  contact_address?: string | null
  business_hours?: string | null
  facebook_url?: string | null
  instagram_url?: string | null
  tiktok_url?: string | null
  announcement_text?: string | null
}

// Same list-then-create-or-update shape as the seo module's upsert
// workflow, minus resource_type/resource_id — there's only ever one row.
const upsertSiteSettingsStep = createStep("upsert-site-settings", async (input: UpsertSiteSettingsInput, { container }) => {
  const siteSettingModuleService = container.resolve<SiteSettingServiceMethods>(SITE_SETTING_MODULE)

  const [existing] = await siteSettingModuleService.listSiteSettings()

  const settings = existing
    ? await siteSettingModuleService.updateSiteSettings({ id: existing.id, ...input })
    : await siteSettingModuleService.createSiteSettings(input)

  return new StepResponse(settings, settings.id)
})

export const upsertSiteSettingsWorkflow = createWorkflow("upsert-site-settings", (input: UpsertSiteSettingsInput) => {
  const settings = upsertSiteSettingsStep(input)
  return new WorkflowResponse(settings)
})
