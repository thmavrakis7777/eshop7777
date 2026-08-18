import Link from "next/link";
import { listNavItems } from "@/lib/admin/navigation";
import { listCategoryTree, listCollections } from "@/lib/admin/taxonomy";
import { NavigationManager } from "@/components/admin/NavigationManager";
import { Card, PageHeader, SectionTitle } from "@/components/admin/ui/primitives";

export const metadata = { title: "Πλοήγηση" };

export default async function AdminNavigationPage() {
  const [items, categoryTree, collections] = await Promise.all([
    listNavItems(),
    listCategoryTree(),
    listCollections(),
  ]);

  // Every active category, not only top-level ones: a nav item pointing
  // straight at a subcategory ("Τηγάνια") is a normal thing to want.
  const categories = categoryTree
    .filter((c) => c.isActive)
    .map((c) => ({
      slug: c.slug,
      label: `${"— ".repeat(c.depth)}${c.name}`,
    }));

  return (
    <>
      <PageHeader
        title="Πλοήγηση"
        description="Τι εμφανίζεται στη μπάρα του καταστήματος, με ποια σειρά και με ποια χρώματα."
        action={
          <Link
            href="/"
            target="_blank"
            className="rounded-md border border-border px-3.5 py-2 text-sm text-ink hover:bg-surface"
          >
            Προβολή καταστήματος →
          </Link>
        }
      />

      <div className="flex flex-col gap-8">
        <NavigationManager items={items} categories={categories} collections={collections.map((c) => ({ slug: c.slug, label: c.title }))} />

        <section>
          <SectionTitle>Πώς λειτουργεί</SectionTitle>
          <Card>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-muted">
              <li>
                Η σειρά της λίστας είναι <strong className="text-ink">η σειρά στη μπάρα</strong>,
                από αριστερά προς τα δεξιά.
              </li>
              <li>
                Χωρίς κανένα στοιχείο, το κατάστημα δείχνει{" "}
                <strong className="text-ink">αυτόματα τις κύριες κατηγορίες</strong> — δεν μένει
                ποτέ με άδεια μπάρα.
              </li>
              <li>
                Ένα στοιχείο <strong className="text-ink">Κατηγορίας</strong> ανοίγει το μενού με
                τις υποκατηγορίες του. Τα υπόλοιπα είναι απλοί σύνδεσμοι.
              </li>
              <li>
                <strong className="text-ink">Προσφορές</strong> και{" "}
                <strong className="text-ink">Νέες αφίξεις</strong> δεν χρειάζονται κατηγορία ή
                συλλογή: οι σελίδες τους ενημερώνονται μόνες τους από τον κατάλογο.
              </li>
              <li>
                Τα χρώματα είναι προαιρετικά και δέχονται μόνο χρώμα — δεν μπορούν να χαλάσουν τη
                διάταξη. Η προεπισκόπηση δείχνει την αντίθεση για την αναγνωσιμότητα.
              </li>
              <li>
                Οι κατηγορίες και οι συλλογές φτιάχνονται στις{" "}
                <Link href="/admin/categories" className="text-ink underline underline-offset-2">
                  Κατηγορίες
                </Link>{" "}
                και στις{" "}
                <Link href="/admin/collections" className="text-ink underline underline-offset-2">
                  Συλλογές
                </Link>
                .
              </li>
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}
