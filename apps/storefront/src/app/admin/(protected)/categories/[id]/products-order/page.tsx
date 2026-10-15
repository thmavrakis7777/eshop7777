import { notFound } from "next/navigation";
import { getCategoryForOrdering } from "@/lib/admin/taxonomy";
import { getProductsByCategorySlug } from "@/lib/db/catalog";
import { formatPrice } from "@/lib/format";
import { CategoryProductOrder, type OrderableProduct } from "@/components/admin/CategoryProductOrder";
import { EmptyState, PageHeader } from "@/components/admin/ui/primitives";

export const metadata = { title: "Σειρά προϊόντων" };

// Far above any real category today (the largest lists 9). Past it, the
// remaining products would simply keep their automatic order after the
// placed ones, which is the same thing that happens to unplaced products.
const MAX_ORDERABLE = 1000;

export default async function CategoryProductOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A malformed id must 404, not surface a Postgres uuid syntax error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const category = await getCategoryForOrdering(id);
  if (!category) notFound();

  const breadcrumb = [
    { label: "Κατηγορίες", href: "/admin/categories" },
    ...category.ancestorNames.map((label) => ({ label })),
    { label: category.name },
  ];
  const header = (
    <PageHeader
      title={`Σειρά προϊόντων: ${category.name}`}
      breadcrumb={breadcrumb}
      description="Η σειρά με την οποία εμφανίζονται τα προϊόντα στη σελίδα της κατηγορίας, όταν η ταξινόμηση είναι «Προεπιλογή». Κάθε κατηγορία και υποκατηγορία έχει τη δική της σειρά."
    />
  );

  if (category.pageType === "landing") {
    return (
      <>
        {header}
        <EmptyState
          title="Αυτή η κατηγορία δεν έχει λίστα προϊόντων"
          description="Είναι σελίδα περιεχομένου (landing), οπότε δεν εμφανίζει προϊόντα."
        />
      </>
    );
  }
  if (!category.isActive) {
    return (
      <>
        {header}
        <EmptyState
          title="Η κατηγορία είναι ανενεργή"
          description="Ενεργοποίησέ την από τις Κατηγορίες για να ορίσεις τη σειρά των προϊόντων της."
        />
      </>
    );
  }

  // Exactly the storefront's listing for this page — the same subtree,
  // cross-listed subcategories and active-only rule — so the owner arranges
  // what shoppers actually see.
  const { products } = await getProductsByCategorySlug(category.slug, { limit: MAX_ORDERABLE });

  // The storefront drops sold-out products to the end for now; the editor
  // shows the owner's intended order instead (placed by position, then the
  // rest as the storefront lists them), so saving again never bakes a
  // temporary stock-out into the order.
  const placedIndex = new Map(category.placedProductIds.map((pid, i) => [pid, i]));
  const ordered = products
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const pa = placedIndex.get(a.p.id);
      const pb = placedIndex.get(b.p.id);
      if (pa !== undefined && pb !== undefined) return pa - pb;
      if (pa !== undefined) return -1;
      if (pb !== undefined) return 1;
      return a.i - b.i;
    })
    .map(({ p }): OrderableProduct => ({
      id: p.id,
      title: p.title,
      code: p.code,
      imageUrl: p.imageUrl,
      price: p.priceRange ? `από ${formatPrice(p.priceRange.min)}` : formatPrice(p.price),
      isAvailable: p.isAvailable,
      isPlaced: placedIndex.has(p.id),
    }));

  const hasSavedOrder = ordered.some((p) => p.isPlaced);

  return (
    <>
      {header}
      {ordered.length === 0 ? (
        <EmptyState
          title="Δεν υπάρχουν ενεργά προϊόντα"
          description="Η κατηγορία και οι υποκατηγορίες της δεν έχουν ακόμα ενεργά προϊόντα."
        />
      ) : (
        // Keyed by the saved order so a save/reset (router.refresh) resets
        // the editor's local state to what's now stored.
        <CategoryProductOrder
          key={category.placedProductIds.join(",")}
          categoryId={category.id}
          products={ordered}
          hasSavedOrder={hasSavedOrder}
        />
      )}
    </>
  );
}
