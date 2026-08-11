import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SEARCH_SYNONYM_MODULE } from "../../../modules/search-synonyms"
import type { SearchSynonymServiceMethods } from "../../../modules/search-synonyms/service"
import { createSearchSynonymWorkflow, type CreateSearchSynonymInput } from "../../../workflows/search-synonyms/manage-search-synonym"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<SearchSynonymServiceMethods>(SEARCH_SYNONYM_MODULE)
  const synonyms = await service.listSearchSynonyms({})
  res.json({ synonyms })
}

export async function POST(req: MedusaRequest<CreateSearchSynonymInput>, res: MedusaResponse) {
  const { result: synonym } = await createSearchSynonymWorkflow(req.scope).run({
    input: req.body,
  })
  res.json({ synonym })
}
