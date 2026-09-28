import { listCategoryOptions, suggestNextSku } from "@/lib/admin/products";
import { NewProductForm } from "@/components/admin/NewProductForm";
import { PageHeader } from "@/components/admin/ui/primitives";

export const metadata = { title: "Νέο προϊόν" };

/**
 * Deliberately minimal: title, SKU, price, stock, category, photos.
 * Everything else belongs in the editor, where there is room for it. Asking
 * for twenty fields before a product can exist is how products stop getting
 * added.
 */
export default async function NewProductPage() {
  const [categories, suggestedSku] = await Promise.all([listCategoryOptions(), suggestNextSku()]);
  return (
    <>
      <PageHeader
        title="Νέο προϊόν"
        description="Συμπλήρωσε τα βασικά — τα υπόλοιπα ρυθμίζονται στη συνέχεια."
        breadcrumb={[{ label: "Προϊόντα", href: "/admin/products" }, { label: "Νέο" }]}
      />
      <div className="max-w-xl">
        <NewProductForm categories={categories} suggestedSku={suggestedSku} />
      </div>
    </>
  );
}
