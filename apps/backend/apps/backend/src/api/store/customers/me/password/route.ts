import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import type { IAuthModuleService } from "@medusajs/framework/types"
import { changeCustomerPasswordWorkflow } from "../../../../../workflows/auth/change-customer-password"

// Medusa's built-in POST /auth/customer/emailpass/update only accepts a
// reset-purpose token (see its middleware, validateToken — it explicitly
// rejects a normal session/bearer token: "Reject session bearer tokens (no
// purpose claim)"). There is no core route for "change my password while
// already logged in", so this is a small custom one. Already covered by
// Medusa's own `/store/customers/me*` wildcard authentication middleware
// (storeCustomerRoutesMiddlewares) — no separate middleware registration
// needed here, req.auth_context is already populated by the time this runs.
type ChangePasswordBody = { current_password?: unknown; new_password?: unknown }

export async function POST(req: AuthenticatedMedusaRequest<ChangePasswordBody>, res: MedusaResponse) {
  const { current_password, new_password } = req.body ?? {}
  if (typeof current_password !== "string" || typeof new_password !== "string" || !current_password || !new_password) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "current_password and new_password are required")
  }
  if (new_password.length < 8) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "new_password must be at least 8 characters")
  }

  const authModuleService: IAuthModuleService = req.scope.resolve(Modules.AUTH)

  const authIdentity = await authModuleService.retrieveAuthIdentity(req.auth_context.auth_identity_id, {
    relations: ["provider_identities"],
  })
  const emailpassIdentity = authIdentity.provider_identities?.find((pi) => pi.provider === "emailpass")
  if (!emailpassIdentity) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This account has no password-based credentials")
  }
  const email = emailpassIdentity.entity_id

  const { success: currentPasswordValid } = await authModuleService.authenticate("emailpass", {
    body: { email, password: current_password },
  })
  if (!currentPasswordValid) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Current password is incorrect")
  }

  const { result } = await changeCustomerPasswordWorkflow(req.scope).run({
    input: { email, newPassword: new_password },
  })

  res.status(200).json(result)
}
