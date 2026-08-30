"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProductImageAction, deleteProductImageAction } from "@/lib/admin/catalog-actions";
import { publicImageUrl } from "@/lib/storage/urls";
import type { AdminProductImage } from "@/lib/admin/products";

const hint = "text-xs text-ink-muted";

/**
 * A product has a LIST of images (position 0 = primary, shown on cards and
 * search — see 0001_init.sql), unlike the single-path fields on categories
 * or homepage blocks. So this manages its own upload/delete round trips
 * directly against the server, rather than filling in a field for the
 * surrounding form's own save button to persist later.
 */
export function ProductImageManager({ productId, images }: { productId: string; images: AdminProductImage[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUpload(file: File | undefined) {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const result = await addProductImageAction(productId, formData);
      if (!result.ok) setError(result.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    });
  }

  function handleDelete(imageId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteProductImageAction(productId, imageId);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div>
      {images.length === 0 ? (
        <p className={hint}>Δεν υπάρχουν εικόνες ακόμα. Η πρώτη που θα ανέβει γίνεται η κύρια.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((img, i) => {
            const url = publicImageUrl(img.storagePath);
            return (
              <li key={img.id} className="group relative">
                {url && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin media-library thumbnail, arbitrary uploaded path.
                  <img
                    src={url}
                    alt={img.altText ?? ""}
                    className="aspect-square w-full rounded-md border border-border object-cover"
                  />
                )}
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-medium text-bg">
                    Κύρια
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(img.id)}
                  disabled={pending}
                  className="absolute right-1 top-1 rounded-sm bg-bg/90 px-1.5 py-0.5 text-xs text-danger opacity-0 transition-opacity hover:bg-bg group-hover:opacity-100 disabled:opacity-50"
                  aria-label="Διαγραφή εικόνας"
                >
                  Διαγραφή
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <label className="mt-3 flex w-fit cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm text-ink transition-colors hover:bg-surface has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
        {pending ? "Μεταφόρτωση…" : "Ανέβασμα εικόνας"}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          disabled={pending}
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
      </label>
      <p className={`mt-1.5 ${hint}`}>
        Προτεινόμενο μέγεθος 1600×1600px (τετράγωνο) — αλλάζει μέγεθος και μορφή αυτόματα ανά συσκευή.
      </p>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
