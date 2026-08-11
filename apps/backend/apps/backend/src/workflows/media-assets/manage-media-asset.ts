import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MEDIA_ASSET_MODULE } from "../../modules/media-assets"
import type { MediaAssetRecord, MediaAssetServiceMethods } from "../../modules/media-assets/service"

// Same three-workflow shape as homepage-blocks/search-synonyms — a
// genuine open-ended list (create/delete), not a fixed key to upsert.

export type CreateMediaAssetInput = Pick<MediaAssetRecord, "label" | "url">

const createMediaAssetStep = createStep("create-media-asset", async (input: CreateMediaAssetInput, { container }) => {
  const service = container.resolve<MediaAssetServiceMethods>(MEDIA_ASSET_MODULE)
  const asset = await service.createMediaAssets(input)
  return new StepResponse(asset, asset.id)
})

export const createMediaAssetWorkflow = createWorkflow("create-media-asset", (input: CreateMediaAssetInput) => {
  const asset = createMediaAssetStep(input)
  return new WorkflowResponse(asset)
})

export type UpdateMediaAssetInput = Pick<MediaAssetRecord, "id"> & Partial<MediaAssetRecord>

const updateMediaAssetStep = createStep("update-media-asset", async (input: UpdateMediaAssetInput, { container }) => {
  const service = container.resolve<MediaAssetServiceMethods>(MEDIA_ASSET_MODULE)
  const asset = await service.updateMediaAssets(input)
  return new StepResponse(asset, asset.id)
})

export const updateMediaAssetWorkflow = createWorkflow("update-media-asset", (input: UpdateMediaAssetInput) => {
  const asset = updateMediaAssetStep(input)
  return new WorkflowResponse(asset)
})

export type DeleteMediaAssetInput = { id: string }

const deleteMediaAssetStep = createStep("delete-media-asset", async (input: DeleteMediaAssetInput, { container }) => {
  const service = container.resolve<MediaAssetServiceMethods>(MEDIA_ASSET_MODULE)
  await service.deleteMediaAssets(input.id)
  return new StepResponse(input.id, input.id)
})

export const deleteMediaAssetWorkflow = createWorkflow("delete-media-asset", (input: DeleteMediaAssetInput) => {
  const id = deleteMediaAssetStep(input)
  return new WorkflowResponse(id)
})
