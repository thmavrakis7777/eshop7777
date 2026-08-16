import { getAdminUser } from "@/lib/admin/auth";
import { listAdminUsers } from "@/lib/admin/settings";
import { AdminUsersManager } from "@/components/admin/AdminUsersManager";
import { Card, SectionTitle } from "@/components/admin/ui/primitives";

export const metadata = { title: "Διαχειριστές" };

export default async function AdminUsersSettingsPage() {
  const admin = await getAdminUser();
  if (!admin) return null;

  // Staff see an explanation rather than a disabled screen — the server
  // refuses these actions regardless (requireOwner), so rendering the
  // controls would only invite a rejection.
  if (admin.role !== "owner") {
    return (
      <>
        <SectionTitle>Διαχειριστές</SectionTitle>
        <Card>
          <p className="text-sm text-ink-muted">
            Η διαχείριση λογαριασμών είναι διαθέσιμη μόνο στους ιδιοκτήτες. Ο δικός σου ρόλος είναι
            «Προσωπικό».
          </p>
        </Card>
      </>
    );
  }

  const users = await listAdminUsers();
  const owners = users.filter((u) => u.role === "owner" && u.isActive).length;

  return (
    <>
      <SectionTitle hint={`${users.length} λογαριασμοί, ${owners} ιδιοκτήτες`}>Διαχειριστές</SectionTitle>
      <p className="mb-4 text-sm text-ink-muted">
        Λογαριασμοί με πρόσβαση στη διαχείριση. Δεν έχουν καμία σχέση με τους πελάτες του καταστήματος.
      </p>

      <AdminUsersManager users={users} currentAdminId={admin.id} />

      <div className="mt-6">
        <Card>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-muted">
            <li>
              <strong className="text-ink">Ιδιοκτήτης</strong> — πλήρης πρόσβαση, συμπεριλαμβανομένης της
              διαχείρισης άλλων λογαριασμών.
            </li>
            <li>
              <strong className="text-ink">Προσωπικό</strong> — όλα τα υπόλοιπα: προϊόντα, παραγγελίες,
              πελάτες, περιεχόμενο.
            </li>
            <li>
              Ο τελευταίος ενεργός ιδιοκτήτης δεν μπορεί να απενεργοποιηθεί ή να υποβιβαστεί — αλλιώς το
              κατάστημα θα κλείδωνε έξω από τη διαχείρισή του.
            </li>
            <li>Η απενεργοποίηση τερματίζει αμέσως όλες τις ενεργές συνεδρίες του λογαριασμού.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
