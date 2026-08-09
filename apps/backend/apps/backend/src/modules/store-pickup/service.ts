import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentOption,
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"

// Single fulfillment option today (one physical pickup point) — the point
// of a dedicated provider isn't multiple options yet, it's giving "pickup"
// its own identifiable provider id (fp_store-pickup_...) so the storefront
// and admin can tell it apart from a real courier shipment, and so a future
// second pickup point is an entry in getFulfillmentOptions, not a rewrite.
class StorePickupFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "store-pickup"

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: "store-pickup", is_return: false }]
  }

  async validateOption(): Promise<boolean> {
    return true
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: ValidateFulfillmentDataContext
  ): Promise<Record<string, unknown>> {
    return { ...data, ...optionData }
  }

  async canCalculate(): Promise<boolean> {
    return false
  }

  async calculatePrice(
    _optionData: CalculateShippingOptionPriceDTO["optionData"],
    _data: CalculateShippingOptionPriceDTO["data"],
    _context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Store pickup does not support calculated pricing — it is always a flat rate"
    )
  }

  // Nothing to call out to — pickup has no external courier. The order
  // simply becomes ready-for-pickup at the physical location; there is no
  // label, no tracking number.
  async createFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(): Promise<Record<string, never>> {
    return {}
  }
}

export default StorePickupFulfillmentService
