import Link from "next/link";
import { getAdminUser } from "@/lib/admin/auth";
import { getAdminSiteSettings } from "@/lib/admin/cms";
import { changeOwnPasswordAction, updateOwnProfileAction } from "@/lib/admin/settings-actions";
import { CmsForm } from "@/components/admin/CmsForm";
import { Card, SectionTitle } from "@/components/admin/ui/primitives";

export const metadata = { title: "Λογαριασμός" };

export default async function AdminAccountSettingsPage() {
  const [admin, settings] = await Promise.all([getAdminUser(), getAdminSiteSettings()]);
  if (!admin) return null; // The protected layout already redirects; this is for types.

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <section>
          <SectionTitle>Το προφίλ σου</SectionTitle>
          <Card>
            <p className="mb-4 text-sm text-ink-muted">
              Συνδεδεμένος ως <strong className="text-ink">{admin.email}</strong> ·{" "}
              {admin.role === "owner" ? "Ιδιοκτήτης" : "Προσωπικό"}
            </p>
            <CmsForm
              action={updateOwnProfileAction}
              values={{ name: admin.name }}
              fields={[{ name: "name", label: "Όνομα", type: "text" }]}
            />
          </Card>
        </section>

        <section>
          <SectionTitle>Αλλαγή κωδικού</SectionTitle>
          <Card>
            <CmsForm
              action={changeOwnPasswordAction}
              submitLabel="Αλλαγή κωδικού"
              values={{}}
              fields={[
                { name: "currentPassword", label: "Τρέχων κωδικός", type: "text" },
                {
                  name: "newPassword",
                  label: "Νέος κωδικός",
                  type: "text",
                  hint: "Τουλάχιστον 12 χαρακτήρες — ο λογαριασμός αυτός βλέπει κάθε παραγγελία και αλλάζει κάθε τιμή.",
                },
                { name: "confirmPassword", label: "Επιβεβαίωση νέου κωδικού", type: "text" },
              ]}
            >
              <p className="text-xs text-ink-muted">
                Με την αλλαγή τερματίζονται όλες οι άλλες συνεδρίες σου. Αυτή η καρτέλα παραμένει
                συνδεδεμένη.
              </p>
            </CmsForm>
          </Card>
        </section>
      </div>

      <div className="flex flex-col gap-6">
        <section>
          <SectionTitle>Κατάστημα</SectionTitle>
          <Card>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Συντελεστής ΦΠΑ</dt>
                <dd className="tabular-nums text-ink">{settings.defaultVatRate}%</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Νόμισμα</dt>
                <dd className="text-ink">EUR (€)</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Τρόπος πληρωμής</dt>
                <dd className="text-ink">Αντικαταβολή</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-border pt-3 text-xs text-ink-muted">
              Οι τιμές καταχωρούνται <strong className="text-ink">με ΦΠΑ</strong>, όπως τις βλέπει ο πελάτης
              — έτσι το απαιτεί η ελληνική νομοθεσία για λιανική. Ο ΦΠΑ εμφανίζεται αναλυτικά στο καλάθι
              και στα παραστατικά. Αλλαγή του συντελεστή γίνεται από τα{" "}
              <Link href="/admin/content/layout" className="text-ink underline underline-offset-2">
                στοιχεία καταστήματος
              </Link>
              .
            </p>
          </Card>
        </section>

        <section>
          <SectionTitle>Πληρωμές</SectionTitle>
          <Card>
            <p className="text-sm text-ink-muted">
              Αυτή τη στιγμή υποστηρίζεται μόνο <strong className="text-ink">αντικαταβολή</strong> — ο
              πελάτης πληρώνει κατά την παράδοση. Δεν υπάρχει τίποτα να ρυθμιστεί.
            </p>
            <p className="mt-3 text-xs text-ink-muted">
              Η προσθήκη κάρτας (π.χ. Stripe) χρειάζεται λογαριασμό εμπόρου και πραγματικά κλειδιά API —
              είναι εμπορική απόφαση, όχι ρύθμιση.
            </p>
          </Card>
        </section>
      </div>
    </div>
  );
}
