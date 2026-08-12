import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MEDIA_ASSET_MODULE } from "../../../modules/media-assets"
import type { MediaAssetServiceMethods } from "../../../modules/media-assets/service"
import { createMediaAssetWorkflow, type CreateMediaAssetInput } from "../../../workflows/media-assets/manage-media-asset"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<MediaAssetServiceMethods>(MEDIA_ASSET_MODULE)
  const assets = await service.listMediaAssets({})
  res.json({ assets })
}

export async function POST(req: MedusaRequest<CreateMediaAssetInput>, res: MedusaResponse) {
  const { label, url } = req.body
  if (!label?.trim() || !url?.trim()) {
    res.status(400).json({ message: "label and url are required" })
    return
  }

  const { result: asset } = await createMediaAssetWorkflow(req.scope).run({
    input: req.body,
  })
  res.json({ asset })
}
