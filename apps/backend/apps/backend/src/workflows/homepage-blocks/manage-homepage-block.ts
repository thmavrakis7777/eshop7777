import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { HOMEPAGE_BLOCK_MODULE } from "../../modules/homepage-blocks"
import type { HomepageBlockRecord, HomepageBlockServiceMethods } from "../../modules/homepage-blocks/service"

// Three small workflows instead of one seo-style upsert — unlike the seo/
// site-settings/content-pages modules, homepage blocks are a genuine list
// the admin adds to and removes from, not a fixed key to look up and
// create-if-missing, so "upsert" doesn't fit; create/update/delete need to
// be distinct operations.

export type CreateHomepageBlockInput = Pick<HomepageBlockRecord, "kind"> & Partial<HomepageBlockRecord>

const createHomepageBlockStep = createStep("create-homepage-block", async (input: CreateHomepageBlockInput, { container }) => {
  const service = container.resolve<HomepageBlockServiceMethods>(HOMEPAGE_BLOCK_MODULE)
  const block = await service.createHomepageBlocks(input)
  return new StepResponse(block, block.id)
})

export const createHomepageBlockWorkflow = createWorkflow("create-homepage-block", (input: CreateHomepageBlockInput) => {
  const block = createHomepageBlockStep(input)
  return new WorkflowResponse(block)
})

export type UpdateHomepageBlockInput = Pick<HomepageBlockRecord, "id"> & Partial<HomepageBlockRecord>

const updateHomepageBlockStep = createStep("update-homepage-block", async (input: UpdateHomepageBlockInput, { container }) => {
  const service = container.resolve<HomepageBlockServiceMethods>(HOMEPAGE_BLOCK_MODULE)
  const block = await service.updateHomepageBlocks(input)
  return new StepResponse(block, block.id)
})

export const updateHomepageBlockWorkflow = createWorkflow("update-homepage-block", (input: UpdateHomepageBlockInput) => {
  const block = updateHomepageBlockStep(input)
  return new WorkflowResponse(block)
})

export type DeleteHomepageBlockInput = { id: string }

const deleteHomepageBlockStep = createStep("delete-homepage-block", async (input: DeleteHomepageBlockInput, { container }) => {
  const service = container.resolve<HomepageBlockServiceMethods>(HOMEPAGE_BLOCK_MODULE)
  await service.deleteHomepageBlocks(input.id)
  return new StepResponse(input.id, input.id)
})

export const deleteHomepageBlockWorkflow = createWorkflow("delete-homepage-block", (input: DeleteHomepageBlockInput) => {
  const id = deleteHomepageBlockStep(input)
  return new WorkflowResponse(id)
})
