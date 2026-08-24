import { getAdminUser } from "@/lib/admin/auth";
import { getEmailSettings } from "@/lib/admin/cms";
import { saveEmailSettingsAction } from "@/lib/admin/cms-actions";
import { CmsForm } from "@/components/admin/CmsForm";
import { Card, PageHeader, SectionTitle } from "@/components/admin/ui/primitives";

export const metadata = { title: "Email" };

export default async function AdminEmailSettingsPage() {
  const [admin, settings] = await Promise.all([getAdminUser(), getEmailSettings()]);
  const isOwner = admin?.role === "owner";

  return (
    <>
      <PageHeader
        title="Email"
        description="Πού πηγαίνουν οι ειδοποιήσεις και τι λέει το email επιβεβαίωσης εγγραφής στο newsletter. Ο αποστολέας (Resend) και το κλειδί API παραμένουν ρυθμίσεις διακομιστή — δεν εμφανίζονται εδώ."
      />

      {!isOwner ? (
        <Card>
          <p className="text-sm text-ink-muted">
            Αυτές οι ρυθμίσεις είναι διαθέσιμες μόνο στους ιδιοκτήτες. Ο δικός σου ρόλος είναι «Προσωπικό».
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <SectionTitle hint="Ποιος ειδοποιείται">Ειδοποιήσεις</SectionTitle>
            <Card>
              <CmsForm
                action={saveEmailSettingsAction}
                values={settings}
                fields={[
                  {
                    name: "ownerNotificationEmail",
                    label: "Email νέας παραγγελίας",
                    type: "email",
                    placeholder: "π.χ. orders@mavrakishome.gr",
                    hint: "Πού στέλνεται η ειδοποίηση κάθε φορά που ολοκληρώνεται μια παραγγελία. Κενό = χρησιμοποιείται το «Email επικοινωνίας» από τα στοιχεία καταστήματος.",
                  },
                  {
                    name: "newsletterNotificationEmail",
                    label: "Email νέας εγγραφής newsletter",
                    type: "email",
                    placeholder: "π.χ. orders@mavrakishome.gr",
                    hint: "Προαιρετικό — ειδοποίηση κάθε φορά που κάποιος εγγράφεται στο newsletter. Κενό = καμία ειδοποίηση (οι εγγραφές παραμένουν όλες ορατές στη λίστα συνδρομητών).",
                  },
                ]}
              />
            </Card>
          </section>

          <section>
            <SectionTitle hint="Email εγγραφής στο newsletter">Κείμενο email επιβεβαίωσης</SectionTitle>
            <Card>
              <CmsForm
                action={saveEmailSettingsAction}
                values={settings}
                fields={[
                  {
                    name: "newsletterFromEmail",
                    label: "Email αποστολέα (προαιρετικό)",
                    type: "email",
                    placeholder: "π.χ. newsletter@mavrakishome.gr",
                    hint: "Πρέπει να ανήκει στον επαληθευμένο τομέα του Resend. Κενό = χρησιμοποιείται ο ίδιος αποστολέας με τα υπόλοιπα email.",
                  },
                  {
                    name: "newsletterSubject",
                    label: "Θέμα",
                    type: "text",
                    placeholder: "Καλώς ήρθες στη λέσχη MAVRAKIS HOME",
                  },
                  {
                    name: "newsletterHeading",
                    label: "Τίτλος",
                    type: "text",
                    placeholder: "Καλώς ήρθες στη λέσχη MAVRAKIS HOME",
                  },
                  {
                    name: "newsletterBody",
                    label: "Κυρίως κείμενο",
                    type: "textarea",
                    rows: 3,
                    placeholder: "Ευχαριστούμε που εγγράφηκες! Θα λαμβάνεις νέες αφίξεις, οδηγούς αγοράς και αποκλειστικές προσφορές απευθείας στο inbox σου.",
                  },
                  {
                    name: "newsletterButtonText",
                    label: "Κείμενο κουμπιού (προαιρετικό)",
                    type: "text",
                    placeholder: "Επίσκεψη στο κατάστημα",
                    hint: "Άφησέ το κενό μαζί με τον σύνδεσμο για email χωρίς κουμπί.",
                  },
                  {
                    name: "newsletterButtonUrl",
                    label: "Σύνδεσμος κουμπιού (προαιρετικό)",
                    type: "text",
                    placeholder: "/",
                    hint: "Σχετική διαδρομή (π.χ. /prosfores) ή πλήρες https:// URL.",
                  },
                  {
                    name: "newsletterFooter",
                    label: "Υποσέλιδο (προαιρετικό)",
                    type: "textarea",
                    rows: 2,
                    placeholder: "Αν θέλεις να διαγραφείς, πάτησε τον σύνδεσμο απεγγραφής παρακάτω.",
                  },
                ]}
              >
                <p className="text-xs text-ink-muted">
                  Ο σύνδεσμος απεγγραφής προστίθεται πάντα αυτόματα στο τέλος του email και δεν
                  επεξεργάζεται εδώ — κάθε παραλήπτης παίρνει τον δικό του, μοναδικό σύνδεσμο.
                </p>
              </CmsForm>
            </Card>
          </section>
        </div>
      )}
    </>
  );
}
