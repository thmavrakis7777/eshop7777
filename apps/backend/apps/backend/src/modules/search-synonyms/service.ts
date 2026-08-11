import { MedusaService } from "@medusajs/framework/utils"
import SearchSynonym from "./models/search-synonym"

class SearchSynonymModuleService extends MedusaService({
  SearchSynonym,
}) {}

// "search_synonym" pluralizes to "search_synonyms" by the regular rule —
// verified live via `medusa exec` anyway before trusting this, standing
// practice since the seo module's Seo/Seoes bug.
export interface SearchSynonymRecord {
  id: string
  terms: string
}

export interface SearchSynonymServiceMethods {
  listSearchSynonyms(filters: Partial<Pick<SearchSynonymRecord, "id">>): Promise<SearchSynonymRecord[]>
  createSearchSynonyms(data: Pick<SearchSynonymRecord, "terms">): Promise<SearchSynonymRecord>
  updateSearchSynonyms(data: Partial<SearchSynonymRecord> & Pick<SearchSynonymRecord, "id">): Promise<SearchSynonymRecord>
  deleteSearchSynonyms(id: string): Promise<void>
}

export default SearchSynonymModuleService
