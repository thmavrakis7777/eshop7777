import { Module } from "@medusajs/framework/utils"
import SearchSynonymModuleService from "./service"

export const SEARCH_SYNONYM_MODULE = "search_synonym"

export default Module(SEARCH_SYNONYM_MODULE, {
  service: SearchSynonymModuleService,
})
