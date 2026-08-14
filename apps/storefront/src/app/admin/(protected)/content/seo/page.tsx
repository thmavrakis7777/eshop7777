import { getHomepageSeo, listCategorySeo } from "@/lib/admin/cms";
import { saveHomepageSeoAction } from "@/lib/admin/cms-actions";
import { CmsForm } from "@/components/admin/CmsForm";
import { CategorySeoEditor } from "@/components/admin/CategorySeoEditor";
import { Card, PageHeader, SectionTitle } from "@/components/admin/ui/primitives";

export const metadata = { title: "SEO" };

export default async function AdminSeoPage() {
  const [homepage, categories] = await Promise.all([getHomepageSeo(), listCategorySeo()]);
  const customised = categories.filter((c) => c.seoTitle || c.metaDescription).length;

  return (
    <>
      <PageHeader
        title="SEO"
        description="Τι βλέπουν οι μηχανές αναζήτησης και τα social όταν μοιράζεται κάποιος τις σελίδες σου."
      />

      <div className="flex flex-col gap-8">
        <section>
          <SectionTitle hint="Η πιο σημαντική σελίδα">Αρχική σελίδα</SectionTitle>
          <Card>
            <CmsForm
              action={saveHomepageSeoAction}
              values={homepage}
              fields={[
                {
                  name: "seoTitle",
                  label: "Τίτλος (title tag)",
                  type: "text",
                  hint: "Ιδανικά 50-60 χαρακτήρες. Αν μείνει κενό, χρησιμοποιείται ο προεπιλεγμένος τίτλος του καταστήματος.",
                },
                {
                  name: "metaDescription",
                  label: "Περιγραφή (meta description)",
                  type: "textarea",
                  rows: 2,
                  hint: "Ιδανικά 140-160 χαρακτήρες. Είναι το κείμενο κάτω από τον τίτλο στα αποτελέσματα αναζήτησης.",
                },
                { name: "ogTitle", label: "Τίτλος για social (Open Graph)", type: "text" },
                { name: "ogDescription", label: "Περιγραφή για social", type: "textarea", rows: 2 },
                {
                  name: "socialImagePath",
                  label: "Εικόνα για social",
                  type: "text",
                  hint: "Εμφανίζεται όταν μοιράζεται κάποιος τον σύνδεσμο. Ενεργοποιείται με τη ρύθμιση του Supabase Storage.",
                },
                { name: "keywords", label: "Λέξεις-κλειδιά", type: "text" },
                {
                  name: "robots",
                  label: "Ευρετηρίαση",
                  type: "select",
                  options: [
                    { value: "index", label: "Να ευρετηριάζεται (index)" },
                    { value: "noindex", label: "Να ΜΗΝ ευρετηριάζεται (noindex)" },
                  ],
                  hint: "Άφησέ το σε «index» εκτός αν έχεις συγκεκριμένο λόγο.",
                },
              ]}
            />
          </Card>
        </section>

        <section>
          <SectionTitle hint={`${customised} από ${categories.length} με προσαρμοσμένο SEO`}>
            Κατηγορίες
          </SectionTitle>
          <CategorySeoEditor categories={categories} />
        </section>

        <section>
          <SectionTitle>Προϊόντα</SectionTitle>
          <Card>
            <p className="text-sm text-ink-muted">
              Το SEO κάθε προϊόντος ρυθμίζεται στη σελίδα του προϊόντος, μαζί με τα υπόλοιπα στοιχεία του —
              είναι πιο εύκολο να γράψεις τίτλο και περιγραφή όταν βλέπεις μπροστά σου το προϊόν.
            </p>
          </Card>
        </section>

        <section>
          <SectionTitle>Αυτόματα</SectionTitle>
          <Card>
            <p className="text-sm text-ink-muted">Παράγονται μόνα τους και δεν χρειάζονται ρύθμιση:</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-muted">
              <li>
                <code className="text-ink">sitemap.xml</code> — κάθε ενεργό προϊόν και κατηγορία
              </li>
              <li>
                <code className="text-ink">robots.txt</code> — αποκλείει καλάθι, checkout, λογαριασμό και διαχείριση
              </li>
              <li>Canonical URLs σε κάθε σελίδα</li>
              <li>Δομημένα δεδομένα (JSON-LD) για προϊόντα, κατηγορίες και το κατάστημα</li>
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}
