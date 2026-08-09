import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService, INotificationModuleService, OrderDTO } from "@medusajs/framework/types"
import { buildOrderConfirmationEmail, type OrderConfirmationEmailData } from "../utils/order-confirmation-email"

// Tax document type/ΑΦΜ details live in cart.metadata during checkout
// (lib/actions/checkout.ts on the storefront) and carry over into
// order.metadata on completion — same keys, read back out here. Kept in
// sync by hand since this is the only other place that reads them.
function readTaxDocumentMetadata(metadata: OrderDTO["metadata"]): {
  taxDocumentType: "receipt" | "invoice"
  invoiceDetails?: OrderConfirmationEmailData["invoiceDetails"]
} {
  if (metadata?.tax_document_type !== "invoice") return { taxDocumentType: "receipt" }

  const companyName = typeof metadata.invoice_company_name === "string" ? metadata.invoice_company_name : ""
  const afm = typeof metadata.invoice_afm === "string" ? metadata.invoice_afm : ""
  if (!companyName || !afm) return { taxDocumentType: "receipt" }

  return {
    taxDocumentType: "invoice",
    invoiceDetails: {
      companyName,
      afm,
      doy: typeof metadata.invoice_doy === "string" ? metadata.invoice_doy : "",
      activity: typeof metadata.invoice_activity === "string" ? metadata.invoice_activity : "",
    },
  }
}

function addressFromOrder(address: OrderDTO["shipping_address"]) {
  return {
    fullName: [address?.first_name, address?.last_name].filter(Boolean).join(" "),
    addressLine1: address?.address_1 ?? "",
    addressLine2: address?.address_2 ?? undefined,
    city: address?.city ?? "",
    postalCode: address?.postal_code ?? "",
  }
}

// Only one Medusa payment provider exists today (pp_system_default,
// presented everywhere else in this project as "Αντικαταβολή" — see
// PaymentSection.tsx's PROVIDER_LABELS). Hardcoded here for the same
// reason it's hardcoded there: reaching into a separate payment-collection
// lookup for a single always-true value would be real complexity for no
// present benefit. Revisit together with PaymentSection.tsx once a second
// real provider (Phase 6, Stripe) exists.
const PAYMENT_METHOD_NAME = "Αντικαταβολή"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  // Never let a broken/unconfigured email provider affect order placement
  // itself — this subscriber runs after the order already exists, so a
  // thrown error here can only break the email, not the sale. Caught and
  // logged, same "never let an optional feature break the primary flow"
  // discipline as every Server Action on the storefront side.
  try {
    const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)
    const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)

    const order = await orderModuleService.retrieveOrder(data.id, {
      relations: ["items", "shipping_address", "billing_address", "shipping_methods"],
    })

    if (!order.email) {
      logger.warn(`order-placed subscriber: order ${order.id} has no email, skipping confirmation email`)
      return
    }

    const emailData: OrderConfirmationEmailData = {
      displayId: order.display_id,
      customerName: [order.shipping_address?.first_name, order.shipping_address?.last_name]
        .filter(Boolean)
        .join(" "),
      email: order.email,
      items: (order.items ?? []).map((item) => ({
        title: item.product_title ?? item.title,
        sku: item.variant_sku ?? null,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.total ?? item.unit_price * item.quantity),
      })),
      subtotal: Number(order.item_subtotal),
      discountTotal: Number(order.discount_total),
      shippingTotal: Number(order.shipping_total),
      taxTotal: Number(order.tax_total),
      total: Number(order.total),
      currencyCode: order.currency_code,
      shippingMethodName: order.shipping_methods?.[0]?.name ?? "",
      paymentMethodName: PAYMENT_METHOD_NAME,
      shippingAddress: addressFromOrder(order.shipping_address),
      billingAddress: addressFromOrder(order.billing_address ?? order.shipping_address),
      ...readTaxDocumentMetadata(order.metadata),
    }

    const { subject, html } = buildOrderConfirmationEmail(emailData)

    await notificationModuleService.createNotifications({
      to: order.email,
      channel: "email",
      content: { subject, html },
    })
  } catch (err) {
    logger.error(`order-placed subscriber failed for order ${data.id}: ${err instanceof Error ? err.message : err}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
