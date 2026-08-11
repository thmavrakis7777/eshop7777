import { model } from "@medusajs/framework/utils"

// A true singleton, same pattern as site_setting/promo_banner — exactly
// one row ever exists (enforced in the upsert workflow's
// list-then-create-or-update logic, not a DB constraint). All four fields
// are optional and nullable: none are fabricated or pre-filled, the admin
// enters only the IDs for services they actually use. Model name is
// singular ("analytics_setting") for the same regular-pluralization
// reason as site_setting — avoids the seo module's Seo/Seoes mismatch.
const AnalyticsSetting = model.define("analytics_setting", {
  id: model.id().primaryKey(),
  ga4_measurement_id: model.text().nullable(),
  gtm_container_id: model.text().nullable(),
  meta_pixel_id: model.text().nullable(),
  clarity_project_id: model.text().nullable(),
})

export default AnalyticsSetting
