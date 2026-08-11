import { MedusaService } from "@medusajs/framework/utils"
import MediaAsset from "./models/media-asset"

class MediaAssetModuleService extends MedusaService({
  MediaAsset,
}) {}

// "media_asset" pluralizes to "media_assets" by the regular rule —
// verified live via `medusa exec` anyway before trusting this, standing
// practice since the seo module's Seo/Seoes bug.
export interface MediaAssetRecord {
  id: string
  label: string
  url: string
  alt_text: string | null
}

export interface MediaAssetServiceMethods {
  listMediaAssets(filters: Partial<Pick<MediaAssetRecord, "id">>): Promise<MediaAssetRecord[]>
  createMediaAssets(data: Pick<MediaAssetRecord, "label" | "url">): Promise<MediaAssetRecord>
  updateMediaAssets(data: Partial<MediaAssetRecord> & Pick<MediaAssetRecord, "id">): Promise<MediaAssetRecord>
  deleteMediaAssets(id: string): Promise<void>
}

export default MediaAssetModuleService
