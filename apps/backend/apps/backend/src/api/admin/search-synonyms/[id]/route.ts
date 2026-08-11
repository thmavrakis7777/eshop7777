import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  deleteSearchSynonymWorkflow,
  updateSearchSynonymWorkflow,
  type UpdateSearchSynonymInput,
} from "../../../../workflows/search-synonyms/manage-search-synonym"

export async function POST(req: MedusaRequest<Omit<UpdateSearchSynonymInput, "id">>, res: MedusaResponse) {
  const { id } = req.params

  const { result: synonym } = await updateSearchSynonymWorkflow(req.scope).run({
    input: { id, ...req.body },
  })
  res.json({ synonym })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  await deleteSearchSynonymWorkflow(req.scope).run({
    input: { id },
  })
  res.json({ id, object: "search_synonym", deleted: true })
}
