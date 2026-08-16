import Link from "next/link";
import { listSynonyms } from "@/lib/admin/settings";
import { SynonymManager } from "@/components/admin/SynonymManager";
import { Card, SectionTitle } from "@/components/admin/ui/primitives";

export const metadata = { title: "Αναζήτηση" };

export default async function AdminSearchSettingsPage() {
  const synonyms = await listSynonyms();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <SectionTitle hint={`${synonyms.length} ομάδες`}>Συνώνυμα</SectionTitle>
        <SynonymManager synonyms={synonyms} />
      </section>

      <section>
        <SectionTitle>Τι κάνει ήδη η αναζήτηση</SectionTitle>
        <Card>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-muted">
            <li>
              Αγνοεί τόνους και τελικό σίγμα — «σεντονια» βρίσκει «Σεντόνια», «τηγανι» βρίσκει «Τηγάνι».
            </li>
            <li>Ανέχεται τυπογραφικά λάθη, με όριο ανάλογο του μήκους της λέξης.</li>
            <li>
              Ψάχνει σε τίτλο, κωδικό (SKU) και όνομα κατηγορίας, με σαφή σειρά προτεραιότητας: ακριβής
              κωδικός πρώτα, μετά τίτλος, μετά κατηγορία, τελευταία τα προσεγγιστικά.
            </li>
            <li>
              Δεν χρειάζεται καμία ρύθμιση για να δουλέψει. Τα συνώνυμα είναι μόνο για λέξεις που δεν
              μοιάζουν μεταξύ τους.
            </li>
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-sm text-ink-muted">
            Η προβολή ή απόκρυψη συγκεκριμένου προϊόντος στην αναζήτηση ρυθμίζεται στη{" "}
            <Link href="/admin/products" className="text-ink underline underline-offset-2">
              σελίδα του προϊόντος
            </Link>
            .
          </p>
        </Card>
      </section>
    </div>
  );
}
