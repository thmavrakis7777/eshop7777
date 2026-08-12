import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { INotificationModuleService } from "@medusajs/framework/types"
import { buildResetPasswordEmail } from "../utils/reset-password-email"

// Medusa's built-in emailpass provider emits this event (generateResetPasswordTokenWorkflow,
// core-flows) whenever /auth/customer/emailpass/reset-password is called — for a customer
// email, actor_type is "customer"; the same event also fires for admin users
// (actor_type "user"), which this store has no email flow for and deliberately ignores.
// entity_id is the email address the reset was requested for; token is a short-lived
// (15 min) JWT the storefront's reset-password page must send back as
// `Authorization: Bearer <token>` to POST /auth/customer/emailpass/update.
type PasswordResetEventData = {
  entity_id: string
  actor_type: string
  token: string
}

export default async function authPasswordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetEventData>): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (data.actor_type !== "customer") return

  // Same "never let an optional email break the primary flow" discipline as
  // order-placed.ts — the reset token already exists once this runs; a
  // broken/unconfigured email provider should only mean the customer sees
  // no email, not a 500 on the reset-password request itself (this
  // subscriber runs after the request already succeeded).
  try {
    const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)

    const storefrontUrl = process.env.STOREFRONT_URL ?? "http://localhost:3000"
    const resetUrl = `${storefrontUrl}/logariasmos/nea-kodikos?token=${encodeURIComponent(data.token)}`

    const { subject, html } = buildResetPasswordEmail({ resetUrl })

    await notificationModuleService.createNotifications({
      to: data.entity_id,
      channel: "email",
      content: { subject, html },
    })
  } catch (err) {
    logger.error(
      `auth-password-reset subscriber failed for ${data.entity_id}: ${err instanceof Error ? err.message : err}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
