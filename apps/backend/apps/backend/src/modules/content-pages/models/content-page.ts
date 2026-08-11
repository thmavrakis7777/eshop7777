import { model } from "@medusajs/framework/utils"

// One row per static content page (About, Shipping, Returns, Privacy,
// Terms, FAQ for Phase D — see storefront's app/{slug}/page.tsx for the
// exact set, each a literal folder rather than a dynamic [slug] route, so
// there is no open-ended arbitrary-page creation in this phase; slug is a
// stable key into that known set, not admin-authorable). Unpublished by
// default — a page with no real content yet should 404 on the storefront,
// not go live with an empty body (same "honest empty state" rule as every
// other admin-editable field in this project).
const ContentPage = model.define("content_page", {
  id: model.id().primaryKey(),
  slug: model.text(),
  title: model.text(),
  body: model.text().nullable(),
  is_published: model.boolean().default(false),
}).indexes([
  {
    on: ["slug"],
    unique: true,
  },
])

export default ContentPage
