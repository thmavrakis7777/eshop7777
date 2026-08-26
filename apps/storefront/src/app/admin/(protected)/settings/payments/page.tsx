import { getAdminUser } from "@/lib/admin/auth";
import { listPaymentMethods } from "@/lib/admin/settings";
import { PaymentMethodsManager } from "@/components/admin/PaymentMethodsManager";
import { Card, SectionTitle } from "@/components/admin/ui/primitives";

export const metadata = { title: "Πληρωμές" };

export default async function AdminPaymentSettingsPage() {
  const admin = await getAdminUser();
  const methods = await listPaymentMethods();
  const active = methods.filter((m) => m.isActive).length;

  // Same tier as shipping — revenue-affecting, store-wide checkout config.
  if (admin?.role !== "owner") {
    return (
      <>
        <SectionTitle>Τρόποι πληρωμής</SectionTitle>
        <Card>
          <p className="text-sm text-ink-muted">
            Οι τρόποι πληρωμής είναι διαθέσιμοι μόνο στους ιδιοκτήτες. Ο δικός σου ρόλος είναι
            «Προσωπικό».
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <SectionTitle hint={`${active} από ${methods.length} ενεργοί`}>Τρόποι πληρωμής</SectionTitle>
      <p className="mb-4 text-sm text-ink-muted">
        Ό,τι ενεργοποιήσεις εδώ εμφανίζεται στο checkout. Μόνο τρόποι που λειτουργούν πραγματικά χωρίς
        πάροχο πληρωμών (αντικαταβολή, τραπεζική κατάθεση) μπορούν να ενεργοποιηθούν.
      </p>
      <PaymentMethodsManager methods={methods} />
    </>
  );
}
