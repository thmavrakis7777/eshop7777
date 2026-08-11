import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { SeoForm } from "../components/seo-form"

// Local, minimal shape — see product-seo.tsx for why this isn't imported
// from @medusajs/types.
type WidgetCategoryData = { id: string }

const CategorySeoWidget = ({ data }: { data: WidgetCategoryData }) => {
  return <SeoForm resourceType="category" resourceId={data.id} />
}

export const config = defineWidgetConfig({
  zone: "product_category.details.side.after",
})

export default CategorySeoWidget
