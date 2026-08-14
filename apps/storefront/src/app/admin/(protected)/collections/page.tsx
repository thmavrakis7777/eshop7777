import { listCollections } from "@/lib/admin/taxonomy";
import { CollectionManager } from "@/components/admin/CollectionManager";
import { PageHeader } from "@/components/admin/ui/primitives";

export const metadata = { title: "Συλλογές" };

export default async function AdminCollectionsPage() {
  const collections = await listCollections();
  return (
    <>
      <PageHeader
        title="Συλλογές"
        description="Ομαδοποιήσεις προϊόντων που δεν ακολουθούν τη δομή των κατηγοριών. Η ένταξη προϊόντων γίνεται από τη σελίδα του προϊόντος."
      />
      <CollectionManager collections={collections} />
    </>
  );
}
