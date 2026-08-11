import { model } from "@medusajs/framework/utils"

// One row per SEO-managed resource (product, category, or the singleton
// homepage record). `resource_type` + `resource_id` together identify what
// this row describes — a generic shape shared across every entity type in
// Phase A/B rather than a separate table per entity, since the field set is
// identical. `resource_id` is "homepage" for the one singleton homepage row
// (no real Product/Category id collides with that string).
const Seo = model.define("seo", {
  id: model.id().primaryKey(),
  resource_type: model.enum(["product", "category", "homepage"]),
  resource_id: model.text(),
  seo_title: model.text().nullable(),
  meta_description: model.text().nullable(),
  canonical_url: model.text().nullable(),
  og_title: model.text().nullable(),
  og_description: model.text().nullable(),
  social_image_url: model.text().nullable(),
  keywords: model.text().nullable(),
  robots: model.enum(["index", "noindex"]).default("index"),
  structured_data_override: model.json().nullable(),
}).indexes([
  {
    on: ["resource_type", "resource_id"],
    unique: true,
  },
])

export default Seo
