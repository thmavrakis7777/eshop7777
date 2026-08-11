import { model } from "@medusajs/framework/utils"

// One row per product needing merchandising extras beyond what Medusa's
// own Product model has — a custom badge label (distinct from the
// storefront's existing "new"/"sale" badges, which are computed from real
// price/date data, not admin-set) plus warranty/downloads text. Keyed by
// the real Medusa product id, not linked via a Module Link, matching this
// project's existing "product" resource_type convention (see the seo
// module) rather than introducing a different linking mechanism for the
// same kind of relationship.
const ProductExtra = model.define("product_extra", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  badge_label: model.text().nullable(),
  badge_tone: model.enum(["accent", "success", "neutral"]).default("neutral"),
  warranty_text: model.text().nullable(),
  downloads_url: model.text().nullable(),
}).indexes([
  {
    on: ["product_id"],
    unique: true,
  },
])

export default ProductExtra
