import { isStorageConfigured } from "@/lib/admin/cms";
import { listMediaLibrary } from "@/lib/admin/media";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/admin/ui/primitives";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { formatBytes } from "@/lib/admin/format-bytes";

export const metadata = { title: "Πολυμέσα" };

/**
 * Media library: every image in storage, where it's used, and the unused
 * ones the owner can delete (lib/admin/media.ts). Images are uploaded where
 * they're used — a product, a category, a homepage section — so there is no
 * upload button here: an image uploaded on its own would only ever be unused.
 */
export default async function AdminMediaPage() {
  const configured = isStorageConfigured();
  const items = configured ? await listMediaLibrary() : [];

  const unused = items.filter((i) => i.usages.length === 0);
  const totalBytes = items.reduce((n, i) => n + i.bytes, 0);
  const unusedBytes = unused.reduce((n, i) => n + i.bytes, 0);

  return (
    <>
      <PageHeader
        title="Πολυμέσα"
        description="Όλες οι εικόνες του καταστήματος και πού χρησιμοποιείται η καθεμία. Όσες δεν χρησιμοποιούνται πουθενά μπορείς να τις διαγράψεις."
      />

      {!configured && (
        <Card className="mb-6 border-accent/30 bg-accent/5">
          <h2 className="text-sm font-semibold text-ink">Το Supabase Storage δεν έχει ρυθμιστεί</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Χρειάζονται οι τιμές <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> και{" "}
            <code className="text-ink">SUPABASE_SERVICE_ROLE_KEY</code> στο περιβάλλον του server.
          </p>
        </Card>
      )}

      {configured && items.length === 0 ? (
        <EmptyState
          title="Δεν υπάρχουν εικόνες"
          description="Οι εικόνες που ανεβάζεις σε προϊόντα, κατηγορίες και στην Αρχική εμφανίζονται εδώ."
        />
      ) : (
        configured && (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <StatCard label="Εικόνες" value={String(items.length)} hint={`${formatBytes(totalBytes)} συνολικά`} />
              <StatCard label="Σε χρήση" value={String(items.length - unused.length)} />
              <StatCard
                label="Δεν χρησιμοποιούνται"
                value={String(unused.length)}
                hint={unused.length > 0 ? `${formatBytes(unusedBytes)} που μπορούν να ελευθερωθούν` : undefined}
                tone={unused.length > 0 ? "warning" : "neutral"}
              />
            </div>
            <MediaLibrary items={items} />
          </>
        )
      )}
    </>
  );
}
