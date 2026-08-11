import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { HOMEPAGE_BLOCK_MODULE } from "../../../modules/homepage-blocks"
import type { HomepageBlockServiceMethods } from "../../../modules/homepage-blocks/service"

const KINDS = ["hero", "promo"] as const
type Kind = (typeof KINDS)[number]

function isKind(value: unknown): value is Kind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value)
}

// Public counterpart to /admin/homepage-blocks — only ever returns
// published blocks, ordered for display. An empty list is a normal,
// expected response (the storefront falls back to its own default
// hero/promo content when nothing's been published), not an error.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { kind } = req.query as Record<string, string | undefined>
  if (!isKind(kind)) {
    res.status(400).json({ message: "kind must be 'hero' or 'promo'" })
    return
  }

  const service = req.scope.resolve<HomepageBlockServiceMethods>(HOMEPAGE_BLOCK_MODULE)
  const blocks = await service.listHomepageBlocks({ kind, is_published: true }, { order: { sort_order: "ASC" } })
  res.json({ blocks })
}
