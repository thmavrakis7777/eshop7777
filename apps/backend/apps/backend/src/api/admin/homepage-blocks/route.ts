import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { HOMEPAGE_BLOCK_MODULE } from "../../../modules/homepage-blocks"
import type { HomepageBlockServiceMethods } from "../../../modules/homepage-blocks/service"
import { createHomepageBlockWorkflow, type CreateHomepageBlockInput } from "../../../workflows/homepage-blocks/manage-homepage-block"

const KINDS = ["hero", "promo"] as const
type Kind = (typeof KINDS)[number]

function isKind(value: unknown): value is Kind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value)
}

// Admin sees every block regardless of published state (so drafts remain
// editable), ordered for display — same sort the storefront will apply
// once published.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { kind } = req.query as Record<string, string | undefined>
  if (!isKind(kind)) {
    res.status(400).json({ message: "kind must be 'hero' or 'promo'" })
    return
  }

  const service = req.scope.resolve<HomepageBlockServiceMethods>(HOMEPAGE_BLOCK_MODULE)
  const blocks = await service.listHomepageBlocks({ kind }, { order: { sort_order: "ASC" } })
  res.json({ blocks })
}

export async function POST(req: MedusaRequest<CreateHomepageBlockInput>, res: MedusaResponse) {
  if (!isKind(req.body.kind)) {
    res.status(400).json({ message: "kind must be 'hero' or 'promo'" })
    return
  }

  const { result: block } = await createHomepageBlockWorkflow(req.scope).run({
    input: req.body,
  })
  res.json({ block })
}
