import { model } from "@medusajs/framework/utils"

// One row per synonym group — a comma-separated list of interchangeable
// search terms (e.g. "τηγάνι, tigani, pan"). A group means "treat any of
// these as the same query" — the storefront's search (lib/search.ts)
// expands a query to every term in its matching group before ranking,
// rather than blending synonym matches into the ranking itself.
const SearchSynonym = model.define("search_synonym", {
  id: model.id().primaryKey(),
  terms: model.text(),
})

export default SearchSynonym
