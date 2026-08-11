import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { SeoForm } from "../components/seo-form"

// Local, minimal shape instead of importing the full AdminProduct type from
// @medusajs/types — this widget only ever reads `id`, and @medusajs/types
// isn't a direct dependency of this app (only transitively available),
// so importing from it would mean adding a dependency for one field.
type WidgetProductData = { id: string }

const ProductSeoWidget = ({ data }: { data: WidgetProductData }) => {
  return <SeoForm resourceType="product" resourceId={data.id} />
}

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
})

export default ProductSeoWidget
