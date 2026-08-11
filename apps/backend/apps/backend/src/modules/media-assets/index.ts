import { Module } from "@medusajs/framework/utils"
import MediaAssetModuleService from "./service"

export const MEDIA_ASSET_MODULE = "media_asset"

export default Module(MEDIA_ASSET_MODULE, {
  service: MediaAssetModuleService,
})
