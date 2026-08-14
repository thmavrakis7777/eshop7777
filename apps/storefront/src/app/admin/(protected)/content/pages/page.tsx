import { listContentPages } from "@/lib/admin/cms";
import { ContentPageEditor } from "@/components/admin/ContentPageEditor";
import { PageHeader } from "@/components/admin/ui/primitives";

export const metadata = { title: "Σελίδες" };

export default async function AdminContentPagesPage() {
  const pages = await listContentPages();

  return (
    <>
      <PageHeader
        title="Σελίδες περιεχομένου"
        description="Οι στατικές σελίδες του καταστήματος — όροι, επιστροφές, επικοινωνία και τα υπόλοιπα που συνδέονται από το υποσέλιδο."
      />
      <ContentPageEditor pages={pages} />
    </>
  );
}
