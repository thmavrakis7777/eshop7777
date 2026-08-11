import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { SEARCH_SYNONYM_MODULE } from "../../modules/search-synonyms"
import type { SearchSynonymRecord, SearchSynonymServiceMethods } from "../../modules/search-synonyms/service"

// Same three-workflow shape as homepage-blocks — a genuine open-ended
// list (create/delete), not a fixed key to upsert.

export type CreateSearchSynonymInput = Pick<SearchSynonymRecord, "terms">

const createSearchSynonymStep = createStep("create-search-synonym", async (input: CreateSearchSynonymInput, { container }) => {
  const service = container.resolve<SearchSynonymServiceMethods>(SEARCH_SYNONYM_MODULE)
  const synonym = await service.createSearchSynonyms(input)
  return new StepResponse(synonym, synonym.id)
})

export const createSearchSynonymWorkflow = createWorkflow("create-search-synonym", (input: CreateSearchSynonymInput) => {
  const synonym = createSearchSynonymStep(input)
  return new WorkflowResponse(synonym)
})

export type UpdateSearchSynonymInput = Pick<SearchSynonymRecord, "id"> & Partial<SearchSynonymRecord>

const updateSearchSynonymStep = createStep("update-search-synonym", async (input: UpdateSearchSynonymInput, { container }) => {
  const service = container.resolve<SearchSynonymServiceMethods>(SEARCH_SYNONYM_MODULE)
  const synonym = await service.updateSearchSynonyms(input)
  return new StepResponse(synonym, synonym.id)
})

export const updateSearchSynonymWorkflow = createWorkflow("update-search-synonym", (input: UpdateSearchSynonymInput) => {
  const synonym = updateSearchSynonymStep(input)
  return new WorkflowResponse(synonym)
})

export type DeleteSearchSynonymInput = { id: string }

const deleteSearchSynonymStep = createStep("delete-search-synonym", async (input: DeleteSearchSynonymInput, { container }) => {
  const service = container.resolve<SearchSynonymServiceMethods>(SEARCH_SYNONYM_MODULE)
  await service.deleteSearchSynonyms(input.id)
  return new StepResponse(input.id, input.id)
})

export const deleteSearchSynonymWorkflow = createWorkflow("delete-search-synonym", (input: DeleteSearchSynonymInput) => {
  const id = deleteSearchSynonymStep(input)
  return new WorkflowResponse(id)
})
