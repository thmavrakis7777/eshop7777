import { getAdminUser } from "@/lib/admin/auth";
import { getAdminAnalytics } from "@/lib/admin/settings";
import { saveAnalyticsAction } from "@/lib/admin/settings-actions";
import { CmsForm } from "@/components/admin/CmsForm";
import { Card, SectionTitle } from "@/components/admin/ui/primitives";

export const metadata = { title: "Analytics" };

export default async function AdminAnalyticsSettingsPage() {
  const admin = await getAdminUser();
  const analytics = await getAdminAnalytics();
  const configured = Object.values(analytics).filter(Boolean).length;

  // Store-wide config, injected into every storefront page — owner-only
  // (saveAnalyticsAction requireOwner). Same "explain, don't disable"
  // pattern as settings/users/page.tsx.
  if (admin?.role !== "owner") {
    return (
      <>
        <SectionTitle>Υπηρεσίες παρακολούθησης</SectionTitle>
        <Card>
          <p className="text-sm text-ink-muted">
            Οι ρυθμίσεις analytics είναι διαθέσιμες μόνο στους ιδιοκτήτες. Ο δικός σου ρόλος είναι
            «Προσωπικό».
          </p>
        </Card>
      </>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <SectionTitle hint={configured === 0 ? "Καμία ενεργή" : `${configured} ενεργές`}>
          Υπηρεσίες παρακολούθησης
        </SectionTitle>
        <Card>
          <CmsForm
            action={saveAnalyticsAction}
            values={analytics}
            fields={[
              {
                name: "ga4MeasurementId",
                label: "Google Analytics 4",
                type: "text",
                placeholder: "G-XXXXXXXXXX",
              },
              {
                name: "gtmContainerId",
                label: "Google Tag Manager",
                type: "text",
                placeholder: "GTM-XXXXXXX",
              },
              { name: "metaPixelId", label: "Meta Pixel", type: "text", placeholder: "1234567890" },
              {
                name: "clarityProjectId",
                label: "Microsoft Clarity",
                type: "text",
                placeholder: "abcdefghij",
              },
            ]}
          />
        </Card>
      </section>

      <section>
        <SectionTitle>Πώς λειτουργεί</SectionTitle>
        <Card>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-muted">
            <li>
              Άφησε κενό ό,τι δεν χρησιμοποιείς. Ένα κενό πεδίο σημαίνει ότι το script{" "}
              <strong className="text-ink">δεν φορτώνεται καθόλου</strong> — δεν επιβαρύνει τη σελίδα.
            </li>
            <li>
              Η μπάρα συγκατάθεσης cookies εμφανίζεται{" "}
              <strong className="text-ink">μόνο</strong> αν έχεις ρυθμίσει τουλάχιστον μία υπηρεσία. Χωρίς
              tracking δεν υπάρχει τίποτα να συναινέσει ο επισκέπτης.
            </li>
            <li>
              Κανένα script δεν φορτώνεται πριν ο επισκέπτης πατήσει «Αποδοχή». Αυτό είναι απαίτηση του
              GDPR, όχι επιλογή.
            </li>
            <li>
              Αν προσθέσεις υπηρεσία που δεν είναι στη λίστα, χρειάζεται και αλλαγή στην πολιτική
              ασφαλείας (CSP) — αλλιώς ο browser θα την μπλοκάρει σιωπηλά.
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
