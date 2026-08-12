import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import type { IAuthModuleService } from "@medusajs/framework/types"

export type ChangeCustomerPasswordInput = {
  email: string
  newPassword: string
}

// The mutation itself (updateProvider) has to live in a step, not the route
// handler — @medusajs/no-service-mutations-in-api-route. Verifying the
// current password (authModuleService.authenticate, read-only) stays in the
// route since it's not a mutation and gates whether this workflow runs at
// all.
const changeCustomerPasswordStep = createStep(
  "change-customer-password",
  async ({ email, newPassword }: ChangeCustomerPasswordInput, { container }) => {
    const authModuleService: IAuthModuleService = container.resolve(Modules.AUTH)

    const { success, error } = await authModuleService.updateProvider("emailpass", {
      entity_id: email,
      password: newPassword,
    })
    if (!success) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, error || "Could not update password")
    }

    return new StepResponse({ success: true })
  }
)

export const changeCustomerPasswordWorkflow = createWorkflow(
  "change-customer-password",
  (input: ChangeCustomerPasswordInput) => {
    const result = changeCustomerPasswordStep(input)
    return new WorkflowResponse(result)
  }
)
