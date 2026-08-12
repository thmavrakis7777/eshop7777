import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROMO_BANNER_MODULE } from "../../../modules/promo-banner"
import type { PromoBannerServiceMethods } from "../../../modules/promo-banner/service"

// Read-only counterpart to /admin/promo-banner — deliberately returns
// null for unpublished *and* expired banners, not just unpublished ones,
// so an admin who forgets to unpublish a finished sale doesn't leave a
// stale "ends in -3 days" banner live. Same "public API never leaks
// content that shouldn't be visible" rule as /store/content-pages.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<PromoBannerServiceMethods>(PROMO_BANNER_MODULE)
  const [banner] = await service.listPromoBanners()

  // Fail closed, not open: an unparseable ends_at (only reachable via a
  // malformed direct API write, never via the admin's datetime-local input)
  // must hide the banner, not leave it live indefinitely.
  const endsAtMs = banner?.ends_at ? new Date(banner.ends_at).getTime() : null
  const isExpired = endsAtMs === null ? false : Number.isNaN(endsAtMs) ? true : endsAtMs <= Date.now()
  const isLive = banner?.is_published && !isExpired

  res.json({ banner: isLive ? banner : null })
}
