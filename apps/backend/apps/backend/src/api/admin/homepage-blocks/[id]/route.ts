import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  deleteHomepageBlockWorkflow,
  updateHomepageBlockWorkflow,
  type UpdateHomepageBlockInput,
} from "../../../../workflows/homepage-blocks/manage-homepage-block"

// A standard Medusa API route dynamic segment (Express-style req.params,
// resolved server-side) — unrelated to and unaffected by the admin UI's
// react-router useParams bug (medusajs/medusa#9794) that shaped the
// content-pages admin route's single-screen design. Backend API route
// params have always worked reliably in this project.
export async function POST(req: MedusaRequest<Omit<UpdateHomepageBlockInput, "id">>, res: MedusaResponse) {
  const { id } = req.params

  const { result: block } = await updateHomepageBlockWorkflow(req.scope).run({
    input: { id, ...req.body },
  })
  res.json({ block })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  await deleteHomepageBlockWorkflow(req.scope).run({
    input: { id },
  })
  res.json({ id, object: "homepage_block", deleted: true })
}
