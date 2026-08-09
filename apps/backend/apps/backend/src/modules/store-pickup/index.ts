import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import StorePickupFulfillmentService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [StorePickupFulfillmentService],
})
