"use client";

import { useRef, useState, useTransition } from "react";
import { uploadMediaAction } from "@/lib/admin/media-actions";
import { preparePhoto, UPLOAD_ONLY } from "@/lib/admin/prepare-photo";
import { slotProcessingNote, type ImageSlotId } from "@/lib/images/slots";
import { publicImageUrl } from "@/lib/storage/urls";
import type { UploadedImage } from "@/lib/storage/upload";

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

// The forms this field sits in name their alt text `imageAlt` (homepage,
// pages), `heroImageAlt` (journal); failing that, the heading or title.
const NAME_FROM = ["imageAlt", "heroImageAlt", "heading", "title", "name"];

function labelFromForm(form: HTMLFormElement | null, names: string[]): string {
  if (!form) return "";
  for (const n of names) {
    const el = form.elements.namedItem(n);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const value = el.value.trim();
      if (value) return value;
    }
  }
  return "";
}

const KB = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;
const FORMAT_NAMES: Record<string, string> = { webp: "WebP", avif: "AVIF", jpg: "JPEG", png: "PNG", gif: "GIF" };

/** «Αποθηκεύτηκε: 1200×900 · WebP 84 KB · AVIF 58 KB (από 2,3 MB)». */
function describeUpload(r: Omit<UploadedImage, "path">, pickedBytes: number): string {
  const size = r.width && r.height ? `${r.width}×${r.height} · ` : "";
  const files = r.files.map((f) => `${FORMAT_NAMES[f.format] ?? f.format} ${KB(f.bytes)}`).join(" · ");
  const from =
    pickedBytes >= 1024 * 1024
      ? `${(pickedBytes / (1024 * 1024)).toLocaleString("el-GR", { maximumFractionDigits: 1 })} MB`
      : KB(pickedBytes);
  const over = r.overBudget
    ? " Η φωτογραφία έχει πολλή λεπτομέρεια, οπότε βγήκε λίγο πάνω από το προτεινόμενο μέγεθος — δεν πειράζει, απλώς φορτώνει λίγο πιο αργά."
    : "";
  return `Αποθηκεύτηκε: ${size}${files} (από ${from}).${over}`;
}

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
  slot,
  placeholder = "https://… ή διαδρομή αρχείου",
  hint,
  nameFrom = NAME_FROM,
}: {
  id?: string;
  name: string;
  defaultValue?: string | null;
  // Which image this is — decides the size, formats and file-size budget
  // the upload is converted to (lib/images/slots.ts) and its storage folder.
  slot: Exclude<ImageSlotId, "product">;
  placeholder?: string;
  // Where the image appears and what shape suits it, for this specific
  // field (lib/admin/image-size-hints.ts). The size and format no longer
  // depend on the uploader — the pipeline converts whatever is picked.
  hint?: string;
  // Fields of the same form whose text names the uploaded file, first
  // non-empty wins: the alt text says what the picture shows, which is what
  // a search engine should read in its file name (lib/images/names.ts).
  nameFrom?: string[];
}) {
  const [path, setPath] = useState(defaultValue ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(picked: File | undefined) {
    if (!picked) return;
    setError(null);
    setSaved(null);
    startTransition(async () => {
      // Only to fit the upload limit — the server makes the real files.
      const file = await preparePhoto(picked, UPLOAD_ONLY);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slot", slot);
      formData.append("label", labelFromForm(fileInputRef.current?.form ?? null, nameFrom) || picked.name);
      const result = await uploadMediaAction(formData);
      if (result.ok && result.path) {
        setPath(result.path);
        if (result.result) setSaved(describeUpload(result.result, picked.size));
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
      <p className="mt-1 text-xs text-ink-muted">{slotProcessingNote(slot)}</p>
      {saved && <p className="mt-1.5 text-xs text-ink">{saved}</p>}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- live preview of an admin-entered/uploaded path, same rationale as CategoryLandingView's hero image.
        <img src={previewUrl} alt="" className="mt-2 h-20 w-20 rounded-md border border-border object-cover" />
      )}
    </div>
  );
}
