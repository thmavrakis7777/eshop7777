"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createProductAction } from "@/lib/admin/catalog-actions";
import { uploadProductPhotos } from "@/lib/admin/upload-product-photos";
import { CategorySelect } from "@/components/admin/CategorySelect";
import { slugFromGreek as slugFromTitle } from "@/lib/slug";
import type { CategoryOption } from "@/lib/admin/products";
import { IMAGE_SIZE_HINTS } from "@/lib/admin/image-size-hints";

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

/**
 * The slug is derived from the title as you type, but stays editable — and
 * stops auto-deriving the moment it is edited by hand, so a deliberate value
 * is never overwritten by a later title tweak.
 *
 * The SKU is NOT derived from the title any more: it used to be the slug in
 * capitals (ANTIKOLLITIKO-TIGANI-28), which is what shoppers then saw as
 * "Κωδικός προϊόντος". It starts as the next free 5-digit number
 * (suggestNextSku) and can be overwritten with a supplier code.
 *
 * Photos can be picked here too, so a product with several photos is one
 * step: the product is created first (photos need it to exist), then the
 * photos go up in the order shown, then the editor opens.
 *
 * The transliteration itself moved to lib/slug.ts when the Journal's two new
 * forms needed the identical function; behaviour is unchanged.
 */

type Photo = { file: File; url: string };

export function NewProductForm({
  categories,
  suggestedSku,
}: {
  categories: CategoryOption[];
  suggestedSku: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState(suggestedSku);
  const [slugTouched, setSlugTouched] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  // Set once the product exists but some photos failed — the form is then
  // locked (submitting again would create a second product) and only offers
  // the way on to the editor, where the photos can be retried.
  const [created, setCreated] = useState<{ productId: string; failures: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const derivedSlug = slugTouched ? slug : slugFromTitle(title);

  // Previews are blob: URLs, held in memory until revoked — tracked here so
  // the ones still showing are released when the form goes away.
  const previewUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function addPhotos(list: FileList | null) {
    const added = (list ? [...list] : []).map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    added.forEach((p) => previewUrls.current.add(p.url));
    setPhotos((prev) => [...prev, ...added]);
  }

  function removePhoto(index: number) {
    const { url } = photos[index];
    URL.revokeObjectURL(url);
    previewUrls.current.delete(url);
    setPhotos((prev) => prev.filter((p) => p.url !== url));
  }

  function makeMain(index: number) {
    setPhotos((prev) => [prev[index], ...prev.filter((_, i) => i !== index)]);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set("slug", derivedSlug);
        data.set("sku", sku);
        setError(null);
        startTransition(async () => {
          const result = await createProductAction(data);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          const failures =
            photos.length === 0
              ? []
              : await uploadProductPhotos(result.productId, photos.map((p) => p.file), (current, total) =>
                  setProgress(`Μεταφόρτωση φωτογραφίας ${current} από ${total}…`)
                );
          setProgress(null);
          if (failures.length === 0) {
            router.push(`/admin/products/${result.productId}`);
          } else {
            setCreated({ productId: result.productId, failures });
          }
        });
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
    >
      <fieldset disabled={created !== null} className="flex flex-col gap-4 disabled:opacity-60">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="np-title" className="text-sm font-medium text-ink">
            Τίτλος
          </label>
          <input
            id="np-title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className={field}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="np-slug" className="text-sm font-medium text-ink">
              Slug (URL)
            </label>
            <input
              id="np-slug"
              value={derivedSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className={field}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="np-sku" className="text-sm font-medium text-ink">
              Κωδικός (SKU)
            </label>
            <input
              id="np-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="π.χ. 00123"
              required
              className={field}
            />
            <p className="text-xs text-ink-muted">Τον βλέπει ο πελάτης ως «Κωδικός προϊόντος».</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="np-price" className="text-sm font-medium text-ink">
              Τιμή (€)
            </label>
            <input id="np-price" name="price" inputMode="decimal" defaultValue="0,00" required className={field} />
            <p className="text-xs text-ink-muted">Με ΦΠΑ, όπως θα τη δει ο πελάτης.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="np-stock" className="text-sm font-medium text-ink">
              Απόθεμα
            </label>
            <input id="np-stock" name="stock" inputMode="numeric" defaultValue="0" className={field} />
          </div>
        </div>

        <CategorySelect categories={categories} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="np-internal-code" className="text-sm font-medium text-ink">
            Εσωτερικός κωδικός (προαιρετικό)
          </label>
          <input id="np-internal-code" name="internalCode" placeholder="π.χ. MH-00125" className={field} />
          <p className="text-xs text-ink-muted">
            Ξεχωριστός από το SKU, δεν εμφανίζεται στον πελάτη — επεξεργάσιμος αργότερα στη σελίδα του προϊόντος.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Φωτογραφίες (προαιρετικό)</span>
          {photos.length > 0 && (
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {photos.map((p, i) => (
                <li key={p.url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a not-yet-uploaded file (blob: URL). */}
                  <img
                    src={p.url}
                    alt=""
                    className="aspect-square w-full rounded-md border border-border object-cover"
                  />
                  {i === 0 ? (
                    <span className="absolute left-1 top-1 rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-medium text-bg">
                      Κύρια
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label="Ορισμός ως κύρια εικόνα"
                      title="Ορισμός ως κύρια εικόνα"
                      onClick={() => makeMain(i)}
                      className="absolute left-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-sm bg-bg/90 text-sm leading-none text-ink shadow-sm hover:bg-bg"
                    >
                      ☆
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Αφαίρεση ${p.file.name}`}
                    title="Αφαίρεση"
                    onClick={() => removePhoto(i)}
                    className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-sm bg-bg/90 text-sm leading-none text-danger shadow-sm hover:bg-bg"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="flex w-fit cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm text-ink transition-colors hover:bg-surface has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
            {photos.length > 0 ? "Προσθήκη κι άλλων" : "Επιλογή φωτογραφιών"}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => addPhotos(e.target.files)}
            />
          </label>
          <p className="text-xs text-ink-muted">
            Μπορείς να επιλέξεις πολλές μαζί. Η πρώτη γίνεται η κύρια (αλλάζει με το ☆). {IMAGE_SIZE_HINTS.product}
          </p>
        </div>

        <p className="text-xs text-ink-muted">
          Το προϊόν δημιουργείται <strong>ανενεργό</strong> — δεν θα εμφανιστεί στο κατάστημα μέχρι να το
          ενεργοποιήσεις.
        </p>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {created ? (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm">
          <p className="text-ink">Το προϊόν δημιουργήθηκε, αλλά κάποιες φωτογραφίες δεν ανέβηκαν:</p>
          <ul className="flex flex-col gap-0.5 text-xs text-danger">
            {created.failures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Link
            href={`/admin/products/${created.productId}`}
            className="self-start rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg hover:bg-ink/90"
          >
            Συνέχεια στο προϊόν — δοκίμασε ξανά εκεί →
          </Link>
        </div>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-ink/90 disabled:opacity-50"
        >
          {progress ?? (pending ? "Δημιουργία…" : "Δημιουργία προϊόντος")}
        </button>
      )}
    </form>
  );
}
