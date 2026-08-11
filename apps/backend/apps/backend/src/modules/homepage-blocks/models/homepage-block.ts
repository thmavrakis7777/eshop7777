import { model } from "@medusajs/framework/utils"

// One row per hero slide or editorial/promo block on the homepage —
// `kind` distinguishes which of the two homepage sections a row belongs
// to. A single model instead of two near-identical ones: the field set
// (eyebrow/heading/body/cta/image/ordering/publish) is genuinely
// identical between "hero slide" and "promo block", so splitting them
// would just duplicate the model/service/workflow/routes for no benefit.
// Unpublished by default — same "a new block shouldn't go live until
// reviewed" rule as content_page's is_published.
const HomepageBlock = model.define("homepage_block", {
  id: model.id().primaryKey(),
  kind: model.enum(["hero", "promo"]),
  eyebrow: model.text().nullable(),
  heading: model.text().nullable(),
  body: model.text().nullable(),
  cta_label: model.text().nullable(),
  cta_href: model.text().nullable(),
  image_url: model.text().nullable(),
  sort_order: model.number().default(0),
  is_published: model.boolean().default(false),
})

export default HomepageBlock
