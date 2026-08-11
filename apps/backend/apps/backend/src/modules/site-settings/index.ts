import { Module } from "@medusajs/framework/utils"
import SiteSettingModuleService from "./service"

export const SITE_SETTING_MODULE = "site_setting"

export default Module(SITE_SETTING_MODULE, {
  service: SiteSettingModuleService,
})
