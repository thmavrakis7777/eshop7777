import { listCategoryTree } from "@/lib/admin/taxonomy";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { PageHeader } from "@/components/admin/ui/primitives";

export const metadata = { title: "Κατηγορίες" };

export default async function AdminCategoriesPage() {
  const categories = await listCategoryTree();
  const topLevel = categories.filter((c) => c.depth === 0).length;

  return (
    <>
      <PageHeader
        title="Κατηγορίες"
        description={`${categories.length} κατηγορίες, ${topLevel} στο πρώτο επίπεδο. Η σειρά εδώ καθορίζει τη σειρά στο μενού του καταστήματος.`}
      />
      <CategoryManager categories={categories} />
    </>
  );
}
