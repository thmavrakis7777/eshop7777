import { model } from "@medusajs/framework/utils"

// A curated, labeled list of externally-hosted image URLs — not real file
// upload/storage. This backend has no object storage configured (Medusa's
// default file provider is local-disk, which doesn't survive a real
// deployment without separately configuring S3 or similar) — building
// upload now would produce files that only work in this dev environment.
// Every image field across this project (Hero/promo blocks, SEO social
// image, etc.) is already a plain URL text input the admin fills in by
// hand; this module gives them one place to label and reuse those URLs
// instead of re-finding/re-typing them per field. See Admin-first
// platform, Phase I for the full reasoning.
const MediaAsset = model.define("media_asset", {
  id: model.id().primaryKey(),
  label: model.text(),
  url: model.text(),
  alt_text: model.text().nullable(),
})

export default MediaAsset
