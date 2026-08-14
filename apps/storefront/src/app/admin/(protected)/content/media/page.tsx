import { isStorageConfigured, listMediaAssets } from "@/lib/admin/cms";
import { Card, EmptyState, PageHeader } from "@/components/admin/ui/primitives";

export const metadata = { title: "Πολυμέσα" };

/**
 * Media library.
 *
 * Uploads need Supabase Storage credentials that are not configured on this
 * project yet. Rather than render an upload button that fails on click, this
 * screen says exactly what is missing and what to do about it — a dead
 * control is worse than an honest gap.
 */
export default async function AdminMediaPage() {
  const [assets, configured] = [await listMediaAssets(), isStorageConfigured()];

  return (
    <>
      <PageHeader
        title="Πολυμέσα"
        description="Οι εικόνες του καταστήματος — φωτογραφίες προϊόντων, banners και εικόνες κατηγοριών."
      />

      {!configured && (
        <Card className="mb-6 border-accent/30 bg-accent/5">
          <h2 className="text-sm font-semibold text-ink">Η μεταφόρτωση εικόνων δεν είναι ενεργή ακόμα</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Χρειάζονται δύο τιμές από το Supabase (Project Settings → API) στο αρχείο{" "}
            <code className="text-ink">apps/storefront/.env.local</code>:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-bg px-3 py-2 text-xs text-ink">
{`NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>`}
          </pre>
          <p className="mt-3 text-sm text-ink-muted">
            Το service role key είναι μυστικό — μένει μόνο στον server και δεν φτάνει ποτέ στον browser.
            Μόλις προστεθούν, ενεργοποιείται η μεταφόρτωση, η αναδιάταξη και το alt text σε προϊόντα,
            hero και εικόνες κατηγοριών.
          </p>
        </Card>
      )}

      {assets.length === 0 ? (
        <EmptyState
          title="Δεν υπάρχουν αρχεία"
          description={
            configured
              ? "Ανέβασε την πρώτη σου εικόνα για να ξεκινήσεις."
              : "Μόλις ρυθμιστεί το Supabase Storage, οι εικόνες που ανεβάζεις θα εμφανίζονται εδώ."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {assets.map((a) => (
            <Card key={a.id}>
              <div className="truncate text-sm font-medium text-ink">{a.label ?? a.storagePath}</div>
              <div className="truncate text-xs text-ink-muted">{a.storagePath}</div>
              {a.altText && <div className="mt-1 text-xs text-ink-muted">alt: {a.altText}</div>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
