import { Module } from "@medusajs/framework/utils"
import ContentPageModuleService from "./service"

export const CONTENT_PAGE_MODULE = "content_page"

export default Module(CONTENT_PAGE_MODULE, {
  service: ContentPageModuleService,
})
