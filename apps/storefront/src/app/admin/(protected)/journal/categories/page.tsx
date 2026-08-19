import { JournalCategoryManager } from "@/components/admin/JournalCategoryManager";
import { PageHeader } from "@/components/admin/ui/primitives";
import { listJournalCategories } from "@/lib/admin/journal";

export const metadata = { title: "Κατηγορίες Journal" };

/**
 * A literal `categories` segment sitting beside `[id]`, so it always wins the
 * match — no article can be reached at /admin/journal/categories.
 */
export default async function AdminJournalCategoriesPage() {
  const categories = await listJournalCategories();

  return (
    <>
      <PageHeader
        title="Κατηγορίες Journal"
        description="Κάθε κατηγορία αποκτά τη δική της σελίδα στο κατάστημα και μπαίνει στο sitemap, εφόσον έχει τουλάχιστον ένα δημοσιευμένο άρθρο."
        breadcrumb={[{ label: "Journal", href: "/admin/journal" }, { label: "Κατηγορίες" }]}
      />
      <JournalCategoryManager categories={categories} />
    </>
  );
}
