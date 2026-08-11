import { Module } from "@medusajs/framework/utils"
import HomepageBlockModuleService from "./service"

export const HOMEPAGE_BLOCK_MODULE = "homepage_block"

export default Module(HOMEPAGE_BLOCK_MODULE, {
  service: HomepageBlockModuleService,
})
