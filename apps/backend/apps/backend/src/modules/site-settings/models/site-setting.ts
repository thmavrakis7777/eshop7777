import { model } from "@medusajs/framework/utils"

// A true singleton — exactly one row ever exists (enforced in the upsert
// workflow's list-then-create-or-update logic, same pattern as the seo
// module's homepage record, not by a DB constraint). Model name is
// deliberately singular ("site_setting") rather than "site_settings" — the
// seo module's own model name ("seo") hit a real MedusaService
// compile-time/runtime pluralization mismatch (see that module's service.ts
// comment); "setting" pluralizes to "settings" by the regular English rule,
// avoiding the same class of bug for an irregular/ambiguous name.
const SiteSetting = model.define("site_setting", {
  id: model.id().primaryKey(),
  footer_tagline: model.text().nullable(),
  contact_phone: model.text().nullable(),
  contact_email: model.text().nullable(),
  contact_address: model.text().nullable(),
  business_hours: model.text().nullable(),
  facebook_url: model.text().nullable(),
  instagram_url: model.text().nullable(),
  tiktok_url: model.text().nullable(),
  announcement_text: model.text().nullable(),
  // Admin-first platform, Phase G — a short reassurance/promo line shown
  // in the cart drawer and cart page (not checkout's order summary,
  // deliberately: CHECKOUT_PREMIUM_SPEC.md's own no-distraction principle
  // for that screen). Same site-wide singleton as everything else here
  // rather than a new module for one more text field.
  cart_message: model.text().nullable(),
})

export default SiteSetting
