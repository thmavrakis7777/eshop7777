import { MedusaService } from "@medusajs/framework/utils"
import AnalyticsSetting from "./models/analytics-setting"

class AnalyticsSettingsModuleService extends MedusaService({
  AnalyticsSetting,
}) {}

// "analytics_setting" pluralizes to "analytics_settings" by the regular
// rule — verified live via `medusa exec` anyway before trusting this,
// standing practice since the seo module's Seo/Seoes bug.
export interface AnalyticsSettingRecord {
  id: string
  ga4_measurement_id: string | null
  gtm_container_id: string | null
  meta_pixel_id: string | null
  clarity_project_id: string | null
}

export interface AnalyticsSettingsServiceMethods {
  listAnalyticsSettings(filters?: Record<string, never>): Promise<AnalyticsSettingRecord[]>
  createAnalyticsSettings(data: Partial<AnalyticsSettingRecord>): Promise<AnalyticsSettingRecord>
  updateAnalyticsSettings(
    data: Partial<AnalyticsSettingRecord> & Pick<AnalyticsSettingRecord, "id">
  ): Promise<AnalyticsSettingRecord>
}

export default AnalyticsSettingsModuleService
