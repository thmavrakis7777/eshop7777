import Link from "next/link";
import { getAdminPromoBanner, getAdminSiteSettings } from "@/lib/admin/cms";
import { savePromoBannerAction, saveSiteSettingsAction } from "@/lib/admin/cms-actions";
import { CmsForm } from "@/components/admin/CmsForm";
import { Card, PageHeader, SectionTitle } from "@/components/admin/ui/primitives";

export const metadata = { title: "Header & Footer" };

const euros = (cents: number | null) => (cents == null ? "" : (cents / 100).toFixed(2).replace(".", ","));

export default async function AdminLayoutContentPage() {
  const [settings, banner] = await Promise.all([getAdminSiteSettings(), getAdminPromoBanner()]);

  return (
    <>
      <PageHeader
        title="Header & Footer"
        description="Ό,τι εμφανίζεται σε κάθε σελίδα του καταστήματος: μπάρα ανακοινώσεων, στοιχεία επικοινωνίας, social και υποσέλιδο."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <section>
            <SectionTitle hint="Πάνω από το header">Μπάρα ανακοίνωσης</SectionTitle>
            <Card>
              <CmsForm
                action={saveSiteSettingsAction}
                values={{ ...settings, freeShippingThreshold: euros(settings.freeShippingThresholdCents), defaultVatRate: String(settings.defaultVatRate) }}
                fields={[
                  {
                    name: "announcementText",
                    label: "Κείμενο ανακοίνωσης",
                    type: "text",
                    hint: "Άφησέ το κενό για να μην εμφανίζεται καθόλου η μπάρα.",
                    placeholder: "Δωρεάν μεταφορικά για παραγγελίες άνω των 50€",
                  },
                  {
                    name: "cartMessage",
                    label: "Μήνυμα στο καλάθι",
                    type: "text",
                    hint: "Εμφανίζεται στο καλάθι, όχι στο checkout.",
                  },
                  {
                    name: "freeShippingThreshold",
                    label: "Όριο δωρεάν μεταφορικών (€)",
                    type: "number",
                    hint: "Χρησιμοποιείται στη μπάρα προόδου του καλαθιού.",
                  },
                  // Every other field on the singleton must round-trip, or
                  // saving this form would blank the ones it does not show.
                  { name: "storeName", label: "Όνομα καταστήματος", type: "text" },
                  { name: "footerTagline", label: "Σύντομη περιγραφή (υποσέλιδο)", type: "textarea", rows: 2 },
                  { name: "contactPhone", label: "Τηλέφωνο", type: "tel" },
                  { name: "contactEmail", label: "Email επικοινωνίας", type: "email" },
                  { name: "contactAddress", label: "Διεύθυνση", type: "text" },
                  { name: "businessHours", label: "Ώρες λειτουργίας", type: "text" },
                  { name: "facebookUrl", label: "Facebook URL", type: "url" },
                  { name: "instagramUrl", label: "Instagram URL", type: "url" },
                  { name: "tiktokUrl", label: "TikTok URL", type: "url" },
                  { name: "logoPath", label: "Λογότυπο (διαδρομή αρχείου)", type: "text" },
                  {
                    name: "defaultVatRate",
                    label: "Συντελεστής ΦΠΑ (%)",
                    type: "number",
                    hint: "Ο κανονικός ελληνικός συντελεστής είναι 24%. Οι τιμές περιλαμβάνουν ΦΠΑ.",
                  },
                ]}
              />
            </Card>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section>
            <SectionTitle hint="Κάτω από το header">Promo banner</SectionTitle>
            <Card>
              <CmsForm
                action={savePromoBannerAction}
                values={{ ...banner, endsAt: banner.endsAt ? banner.endsAt.slice(0, 10) : "" }}
                fields={[
                  { name: "headline", label: "Τίτλος", type: "text" },
                  { name: "body", label: "Κείμενο", type: "textarea", rows: 2 },
                  { name: "ctaLabel", label: "Κείμενο κουμπιού", type: "text" },
                  { name: "ctaHref", label: "Σύνδεσμος κουμπιού", type: "text", placeholder: "/prosfores" },
                  {
                    name: "endsAt",
                    label: "Λήγει",
                    type: "date",
                    hint: "Μετά την ημερομηνία αυτή το banner κρύβεται αυτόματα.",
                  },
                  { name: "isPublished", label: "Δημοσιευμένο", type: "checkbox" },
                ]}
              />
            </Card>
          </section>

          <section>
            <SectionTitle>Μενού πλοήγησης</SectionTitle>
            <Card>
              <p className="text-sm text-ink-muted">
                Το μενού του καταστήματος παράγεται αυτόματα από τις{" "}
                <Link href="/admin/categories" className="text-ink underline underline-offset-2">
                  κατηγορίες
                </Link>{" "}
                — η σειρά και η ονομασία τους εκεί καθορίζουν τι βλέπει ο πελάτης. Έτσι δεν υπάρχει
                περίπτωση το μενού να δείχνει κατηγορία που δεν υπάρχει.
              </p>
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
