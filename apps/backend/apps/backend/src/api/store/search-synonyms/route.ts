import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SEARCH_SYNONYM_MODULE } from "../../../modules/search-synonyms"
import type { SearchSynonymServiceMethods } from "../../../modules/search-synonyms/service"

// Read-only counterpart to /admin/search-synonyms — the storefront's
// search catalog fetches the full list once (small, cached) to expand a
// query against every term in its matching group before ranking.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<SearchSynonymServiceMethods>(SEARCH_SYNONYM_MODULE)
  const synonyms = await service.listSearchSynonyms({})
  res.json({ synonyms })
}
