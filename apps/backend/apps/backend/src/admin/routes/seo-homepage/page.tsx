import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Heading, Text } from "@medusajs/ui"
import { SeoForm } from "../../components/seo-form"

// The homepage has no underlying Medusa entity (no "homepage" model/table),
// so unlike product/category SEO it can't hang off a widget zone — this is
// a genuine standalone admin route instead. Same shared /admin/seo module
// and form as the other two, with resource_id fixed to the "homepage"
// singleton (see src/modules/seo/models/seo.ts for why that string is safe
// — no real Product/Category id can collide with it).
const SeoHomepagePage = () => {
  return (
    <div className="flex flex-col gap-y-3">
      <div className="px-2">
        <Heading level="h1">SEO Αρχικής Σελίδας</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Ρυθμίσεις SEO για την αρχική σελίδα του καταστήματος.
        </Text>
      </div>
      <SeoForm resourceType="homepage" resourceId="homepage" heading="Αρχική Σελίδα" />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "SEO Αρχικής",
})

export default SeoHomepagePage
