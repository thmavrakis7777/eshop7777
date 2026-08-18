import { countDynamicCollections } from "@/lib/admin/products";
import { listCategoryTree } from "@/lib/admin/taxonomy";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { DynamicCollections } from "@/components/admin/DynamicCollections";
import { PageHeader } from "@/components/admin/ui/primitives";

export const metadata = { title: "Κατηγορίες" };

export default async function AdminCategoriesPage() {
  const [categories, dynamicCounts] = await Promise.all([
    listCategoryTree(),
    countDynamicCollections(),
  ]);
  const topLevel = categories.filter((c) => c.depth === 0).length;

  return (
    <>
      <PageHeader
        title="Κατηγορίες"
        description={`${categories.length} κατηγορίες, ${topLevel} στο πρώτο επίπεδο. Η σειρά εδώ καθορίζει τη σειρά στο μενού του καταστήματος.`}
      />
      <DynamicCollections counts={dynamicCounts} />
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink">
          Κατηγορίες προϊόντων
        </h2>
        <p className="mb-3 text-xs text-ink-muted">
          Χειροκίνητες — εσύ αποφασίζεις ποιο προϊόν ανήκει πού.
        </p>
        <CategoryManager categories={categories} />
      </section>
    </>
  );
}
