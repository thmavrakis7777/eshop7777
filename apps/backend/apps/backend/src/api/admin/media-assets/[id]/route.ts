import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  deleteMediaAssetWorkflow,
  updateMediaAssetWorkflow,
  type UpdateMediaAssetInput,
} from "../../../../workflows/media-assets/manage-media-asset"

export async function POST(req: MedusaRequest<Omit<UpdateMediaAssetInput, "id">>, res: MedusaResponse) {
  const { id } = req.params
  const { label, url } = req.body
  if ((label !== undefined && !label?.trim()) || (url !== undefined && !url?.trim())) {
    res.status(400).json({ message: "label and url cannot be empty" })
    return
  }

  const { result: asset } = await updateMediaAssetWorkflow(req.scope).run({
    input: { id, ...req.body },
  })
  res.json({ asset })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  await deleteMediaAssetWorkflow(req.scope).run({
    input: { id },
  })
  res.json({ id, object: "media_asset", deleted: true })
}
