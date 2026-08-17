import Link from "next/link";
import { listHomepageBlocks } from "@/lib/admin/cms";
import { listCategoryTree, listCollections } from "@/lib/admin/taxonomy";
import { HomepageSectionBuilder } from "@/components/admin/HomepageSectionBuilder";
import { Card, PageHeader, SectionTitle } from "@/components/admin/ui/primitives";

export const metadata = { title: "Αρχική σελίδα" };

export default async function AdminHomepagePage() {
  const [sections, categoryTree, collections] = await Promise.all([
    listHomepageBlocks(),
    listCategoryTree(),
    listCollections(),
  ]);
  // Top-level only for the pickers: homepage grids and rails point at main
  // categories, and a flat list of 28 including subcategories is unusable.
  const categories = categoryTree
    .filter((c) => !c.parentId && c.isActive)
    .map((c) => ({ slug: c.slug, label: c.name }));

  return (
    <>
      <PageHeader
        title="Αρχική σελίδα"
        description="Η αρχική συντίθεται από ενότητες, με τη σειρά που τις βάζεις εδώ. Πρόσθεσε, κρύψε, μετακίνησε ή διάγραψε ό,τι θέλεις."
        action={
          <Link
            href="/"
            target="_blank"
            className="rounded-md border border-border px-3.5 py-2 text-sm text-ink hover:bg-surface"
          >
            Προβολή αρχικής →
          </Link>
        }
      />

      <div className="flex flex-col gap-8">
        <HomepageSectionBuilder
          sections={sections}
          categories={categories}
          collections={collections.map((c) => ({ slug: c.slug, label: c.title }))}
        />

        <section>
          <SectionTitle>Πώς λειτουργεί</SectionTitle>
          <Card>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-muted">
              <li>
                Η σειρά της λίστας είναι <strong className="text-ink">η σειρά της σελίδας</strong>, από πάνω
                προς τα κάτω.
              </li>
              <li>
                Δύο ή περισσότερα <strong className="text-ink">διαδοχικά</strong> hero γίνονται αυτόματα
                carousel. Αν παρεμβάλλεται άλλη ενότητα, εμφανίζονται χωριστά.
              </li>
              <li>
                Μια ενότητα χωρίς περιεχόμενο <strong className="text-ink">δεν εμφανίζεται</strong> — π.χ. μια
                λωρίδα προϊόντων της οποίας η κατηγορία διαγράφηκε δεν αφήνει κενό τίτλο.
              </li>
              <li>
                Οι ενότητες «Εγγύηση» και «Newsletter» στο τέλος της σελίδας είναι σταθερές και δεν ρυθμίζονται
                από εδώ ακόμα.
              </li>
              <li>
                Οι εικόνες δέχονται πλήρες URL. Η μεταφόρτωση αρχείων ενεργοποιείται μόλις ρυθμιστεί το
                Supabase Storage (δες{" "}
                <Link href="/admin/content/media" className="text-ink underline underline-offset-2">
                  Πολυμέσα
                </Link>
                ).
              </li>
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}
