"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProductImageAction, reorderProductImagesAction } from "@/lib/admin/catalog-actions";
import { uploadProductPhotos } from "@/lib/admin/upload-product-photos";
import { publicImageUrl } from "@/lib/storage/urls";
import type { AdminProductImage } from "@/lib/admin/products";
import { IMAGE_SIZE_HINTS } from "@/lib/admin/image-size-hints";

const hint = "text-xs text-ink-muted";

/**
 * A product has a LIST of images (position 0 = primary, shown on cards and
 * search — see 0001_init.sql), unlike the single-path fields on categories
 * or homepage blocks. So this manages its own upload/reorder/delete round
 * trips directly against the server, rather than filling in a field for the
 * surrounding form's own save button to persist later.
 *
 * Several photos can be picked at once; they go up one by one, in the order
 * picked (upload-product-photos.ts). Every control sits on the thumbnail
 * itself and is always visible — the delete button used to appear only on
 * mouse hover, which a phone or tablet never has.
 */
export function ProductImageManager({ productId, images }: { productId: string; images: AdminProductImage[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(images);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const working = pending || progress !== null;

  async function handleUpload(list: FileList | null) {
    const files = list ? [...list] : [];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length === 0) return;
    setErrors([]);
    const failures = await uploadProductPhotos(productId, files, (current, total) =>
      setProgress(total > 1 ? `Μεταφόρτωση ${current} από ${total}…` : "Μεταφόρτωση…")
    );
    setProgress(null);
    setErrors(failures);
    router.refresh();
  }

  function move(from: number, to: number) {
    const next = [...shown];
    const [image] = next.splice(from, 1);
    next.splice(to, 0, image);
    setErrors([]);
    startTransition(async () => {
      setShown(next);
      const result = await reorderProductImagesAction(productId, next.map((i) => i.id));
      if (!result.ok) setErrors([result.error]);
      router.refresh();
    });
  }

  function remove(imageId: string) {
    setConfirming(null);
    setErrors([]);
    startTransition(async () => {
      setShown(shown.filter((i) => i.id !== imageId));
      const result = await deleteProductImageAction(productId, imageId);
      if (!result.ok) setErrors([result.error]);
      router.refresh();
    });
  }

  return (
    <div>
      {shown.length === 0 ? (
        <p className={hint}>Δεν υπάρχουν εικόνες ακόμα. Η πρώτη που θα ανέβει γίνεται η κύρια.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {shown.map((img, i) => {
            const url = publicImageUrl(img.storagePath);
            return (
              <li key={img.id} className="relative">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin media-library thumbnail, arbitrary uploaded path.
                  <img
                    src={url}
                    alt={img.altText ?? ""}
                    className="aspect-square w-full rounded-md border border-border object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-md border border-border bg-surface" />
                )}

                {i === 0 ? (
                  <span className="absolute left-1 top-1 rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-medium text-bg">
                    Κύρια
                  </span>
                ) : (
                  <ThumbButton
                    className="absolute left-1 top-1"
                    label="Ορισμός ως κύρια εικόνα"
                    disabled={working}
                    onClick={() => move(i, 0)}
                  >
                    ☆
                  </ThumbButton>
                )}
                <ThumbButton
                  className="absolute right-1 top-1"
                  danger
                  label="Διαγραφή εικόνας"
                  disabled={working}
                  onClick={() => setConfirming(img.id)}
                >
                  ×
                </ThumbButton>
                {shown.length > 1 && (
                  <div className="absolute inset-x-1 bottom-1 flex justify-between">
                    {i > 0 ? (
                      <ThumbButton label="Μετακίνηση αριστερά" disabled={working} onClick={() => move(i, i - 1)}>
                        ‹
                      </ThumbButton>
                    ) : (
                      <span />
                    )}
                    {i < shown.length - 1 && (
                      <ThumbButton label="Μετακίνηση δεξιά" disabled={working} onClick={() => move(i, i + 1)}>
                        ›
                      </ThumbButton>
                    )}
                  </div>
                )}

                {confirming === img.id && (
                  <div
                    role="alertdialog"
                    aria-label="Επιβεβαίωση διαγραφής εικόνας"
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-md border border-danger/40 bg-bg/95 p-1"
                  >
                    <span className="text-xs font-medium text-ink">Διαγραφή;</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        autoFocus
                        onClick={() => remove(img.id)}
                        className="rounded-sm bg-danger px-2 py-0.5 text-xs font-medium text-bg"
                      >
                        Ναι
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="rounded-sm border border-border px-2 py-0.5 text-xs text-ink"
                      >
                        Όχι
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <label className="mt-3 flex w-fit cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm text-ink transition-colors hover:bg-surface has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
        {progress ?? "Ανέβασμα εικόνων"}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          disabled={working}
          onChange={(e) => void handleUpload(e.target.files)}
        />
      </label>
      <p className={`mt-1.5 ${hint}`}>
        Μπορείς να επιλέξεις πολλές μαζί. {IMAGE_SIZE_HINTS.product}
      </p>
      {errors.length > 0 && (
        <ul role="alert" className="mt-1.5 flex flex-col gap-0.5 text-xs text-danger">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ThumbButton({
  label,
  disabled,
  danger = false,
  onClick,
  className = "",
  children,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-sm bg-bg/90 text-sm leading-none shadow-sm transition-colors hover:bg-bg disabled:opacity-50 ${
        danger ? "text-danger" : "text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}
