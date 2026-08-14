import Link from "next/link";
import { listHomepageBlocks } from "@/lib/admin/cms";
import { HomepageBlockManager } from "@/components/admin/HomepageBlockManager";
import { Card, PageHeader, SectionTitle } from "@/components/admin/ui/primitives";

export const metadata = { title: "Αρχική σελίδα" };

export default async function AdminHomepagePage() {
  const blocks = await listHomepageBlocks();

  return (
    <>
      <PageHeader
        title="Αρχική σελίδα"
        description="Οι διαφάνειες του hero και τα προωθητικά μπλοκ. Ό,τι δεν συμπληρώσεις εδώ, το κατάστημα το δείχνει με το προεπιλεγμένο περιεχόμενό του."
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
        <HomepageBlockManager
          blocks={blocks}
          kind="hero"
          title="Hero"
          description="Οι μεγάλες διαφάνειες στην κορυφή της αρχικής σελίδας."
        />

        <HomepageBlockManager
          blocks={blocks}
          kind="promo"
          title="Προωθητικά μπλοκ"
          description="Τα editorial banners χαμηλότερα στη σελίδα."
        />

        <section>
          <SectionTitle>Ενότητες προϊόντων</SectionTitle>
          <Card>
            <p className="text-sm text-ink-muted">
              Οι ενότητες «Προτεινόμενα» και «Νέες αφίξεις» συμπληρώνονται αυτόματα από τον κατάλογο:
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-muted">
              <li>
                <strong className="text-ink">Νέες αφίξεις</strong> — προϊόντα των τελευταίων 30 ημερών, ή όσα
                έχεις σημάνει ως «Νέο» στη σελίδα του προϊόντος.
              </li>
              <li>
                <strong className="text-ink">Προτεινόμενα</strong> — αλφαβητική επιλογή από τον κατάλογο. Μόλις
                υπάρξουν πραγματικές πωλήσεις, θα μπορεί να βασιστεί σε αυτές.
              </li>
              <li>
                <strong className="text-ink">Κατηγορίες</strong> — από τις{" "}
                <Link href="/admin/categories" className="text-ink underline underline-offset-2">
                  κατηγορίες πρώτου επιπέδου
                </Link>
                , με τη σειρά που ορίζεις εκεί.
              </li>
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}
