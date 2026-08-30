"use client";

import { useRef, useState, useTransition } from "react";
import { uploadMediaAction } from "@/lib/admin/media-actions";
import { publicImageUrl } from "@/lib/storage/urls";

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

/**
 * Drop-in replacement for a plain `<input name={name}>` holding an image
 * path/URL. Adds a real upload button ALONGSIDE the text field rather than
 * replacing it — pasting an already-hosted URL is still the fastest path
 * for an external image and needs to keep working exactly as before,
 * Supabase Storage configured or not.
 *
 * Uncontrolled-looking from the outside (same `name`/`defaultValue` contract
 * every other field in these bespoke admin forms uses) but holds its own
 * state internally, because a successful upload has to update the visible
 * text — a plain defaultValue input can't do that after first render.
 */
export function ImageUploadField({
  id,
  name,
  defaultValue,
  folder,
  placeholder = "https://… ή διαδρομή αρχείου",
  hint,
}: {
  id?: string;
  name: string;
  defaultValue?: string | null;
  // Must stay in step with ALLOWED_FOLDERS in lib/admin/media-actions.ts —
  // anything else is silently rewritten to "uploads" server-side.
  folder: "categories" | "homepage" | "branding" | "journal" | "pages";
  placeholder?: string;
  // Recommended dimensions/file size for this specific slot. Most callers of
  // this field render the uploaded file as a plain <img> with no server-side
  // resizing (Hero, Promo banner, category cards) — unlike product photos,
  // whatever gets uploaded here is what every visitor downloads, so getting
  // this right before upload is the whole point of showing it.
  hint?: string;
}) {
  const [path, setPath] = useState(defaultValue ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);
    startTransition(async () => {
      const result = await uploadMediaAction(formData);
      if (result.ok && result.path) {
        setPath(result.path);
      } else if (!result.ok) {
        setError(result.error);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  const previewUrl = publicImageUrl(path || null);

  return (
    <div>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          name={name}
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder={placeholder}
          className={field}
        />
        <label className="flex shrink-0 cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm text-ink transition-colors hover:bg-surface has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
          {pending ? "Μεταφόρτωση…" : "Ανέβασμα"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={pending}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- live preview of an admin-entered/uploaded path, same rationale as CategoryLandingView's hero image.
        <img src={previewUrl} alt="" className="mt-2 h-20 w-20 rounded-md border border-border object-cover" />
      )}
    </div>
  );
}
