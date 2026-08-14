import { notFound } from "next/navigation";
import { getProductForEdit, listCategoryOptions, listCollectionOptions } from "@/lib/admin/products";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { PageHeader } from "@/components/admin/ui/primitives";

export const metadata = { title: "Επεξεργασία προϊόντος" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A malformed id must 404, not surface a Postgres uuid syntax error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [product, categories, collections] = await Promise.all([
    getProductForEdit(id),
    listCategoryOptions(),
    listCollectionOptions(),
  ]);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={product.title}
        breadcrumb={[{ label: "Προϊόντα", href: "/admin/products" }, { label: product.title }]}
      />
      <ProductEditor product={product} categories={categories} collections={collections} />
    </>
  );
}
