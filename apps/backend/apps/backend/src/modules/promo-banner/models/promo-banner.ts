import { model } from "@medusajs/framework/utils"

// A true singleton — one active promo banner at a time, same pattern as
// site_setting. Deliberately named "promo_banner", not "campaign" — that
// name collides with Medusa's own native Campaign entity (part of the
// built-in Promotions module: `campaign.details`/`campaign.list` are real
// admin injection zones, confirmed live when `medusa db:generate`
// rejected the name with a GraphQL type-merge conflict). This module is
// marketing *copy* promoting a real discount, not a second discount
// engine — the actual promotion/discount logic is Medusa's native
// Promotions/Campaigns feature, already in the admin sidebar; the admin
// is expected to keep `ends_at` here in sync with their real promotion's
// dates themselves, same trust level as every other admin-entered fact in
// this project (business_hours, contact_phone, etc.).
const PromoBanner = model.define("promo_banner", {
  id: model.id().primaryKey(),
  headline: model.text().nullable(),
  body: model.text().nullable(),
  cta_label: model.text().nullable(),
  cta_href: model.text().nullable(),
  ends_at: model.text().nullable(),
  is_published: model.boolean().default(false),
})

export default PromoBanner
