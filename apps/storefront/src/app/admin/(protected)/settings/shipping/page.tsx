import { getAdminUser } from "@/lib/admin/auth";
import { listShippingMethods } from "@/lib/admin/settings";
import { ShippingManager } from "@/components/admin/ShippingManager";
import { Card, SectionTitle } from "@/components/admin/ui/primitives";

export const metadata = { title: "Αποστολές" };

export default async function AdminShippingSettingsPage() {
  const admin = await getAdminUser();
  const methods = await listShippingMethods();
  const active = methods.filter((m) => m.isActive).length;

  // Shipping prices are revenue-affecting, store-wide values — owner-only
  // (saveShippingMethodAction/deleteShippingMethodAction both requireOwner).
  // Same "explain, don't disable" pattern as settings/users/page.tsx.
  if (admin?.role !== "owner") {
    return (
      <>
        <SectionTitle>Μέθοδοι αποστολής</SectionTitle>
        <Card>
          <p className="text-sm text-ink-muted">
            Οι μέθοδοι αποστολής είναι διαθέσιμες μόνο στους ιδιοκτήτες. Ο δικός σου ρόλος είναι
            «Προσωπικό».
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <SectionTitle hint={`${active} από ${methods.length} ενεργές`}>Μέθοδοι αποστολής</SectionTitle>
      <p className="mb-4 text-sm text-ink-muted">
        Ό,τι ορίσεις εδώ εμφανίζεται στο checkout με τη σειρά που το βάζεις. Οι τιμές είναι με ΦΠΑ.
      </p>
      <ShippingManager methods={methods} />

      <div className="mt-8">
        <SectionTitle>Ζώνες αποστολής</SectionTitle>
        <Card>
          <p className="text-sm text-ink-muted">
            Το κατάστημα στέλνει σε όλη την Ελλάδα με ενιαία χρέωση ανά μέθοδο. Δεν υπάρχουν ζώνες ανά
            νομό ή νησί — αν χρειαστούν, είναι πραγματική προσθήκη και όχι ρύθμιση, γιατί αλλάζει τον
            τρόπο που υπολογίζεται το κόστος στο καλάθι.
          </p>
        </Card>
      </div>
    </>
  );
}
