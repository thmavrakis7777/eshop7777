"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteMediaAction } from "@/lib/admin/media-actions";
import type { MediaItem } from "@/lib/admin/media";
import { formatBytes } from "@/lib/admin/format-bytes";

/**
 * The media library grid. Filtering, search and selection are all local —
 * a few hundred images is one server read, and narrowing it shouldn't cost
 * a round trip per keystroke. Rendering is capped (PAGE at a time) so the
 * DOM and the lazy thumbnails stay light.
 *
 * Only unused images can be selected or deleted; an image in use shows
 * where, with a link to the place it is edited. Delete is permanent, so it
 * always goes through the confirm dialog, and bulk deletes ask for the
 * count to be typed back (same rule as the product list's bulk actions).
 */

const PAGE = 60;

const FOLDERS: Record<string, string> = {
  products: "Προϊόντα",
  categories: "Κατηγορίες",
  homepage: "Αρχική",
  journal: "Journal",
  pages: "Σελίδες",
  branding: "Λογότυπο / brand",
};

const dateFmt = new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", year: "numeric" });

type Usage = "all" | "used" | "unused";
type Sort = "newest" | "oldest" | "largest";

export function MediaLibrary({ items }: { items: MediaItem[] }) {
  const router = useRouter();
  const [usage, setUsage] = useState<Usage>("all");
  const [folder, setFolder] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string[] | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const folders = useMemo(() => [...new Set(items.map((i) => i.folder))].sort(), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter(
      (i) =>
        (usage === "all" || (usage === "used" ? i.usages.length > 0 : i.usages.length === 0)) &&
        (folder === "all" || i.folder === folder) &&
        (!q ||
          i.name.toLowerCase().includes(q) ||
          i.usages.some((u) => u.label.toLowerCase().includes(q)) ||
          (i.altText ?? "").toLowerCase().includes(q))
    );
    return list.sort((a, b) =>
      sort === "largest"
        ? b.bytes - a.bytes
        : sort === "oldest"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt)
    );
  }, [items, usage, folder, query, sort]);

  const deletableInView = filtered.filter((i) => i.usages.length === 0);
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function askDelete(keys: string[]) {
    setConfirming(keys);
    setConfirmText("");
  }

  function runDelete(keys: string[]) {
    startTransition(async () => {
      const result = await deleteMediaAction(keys);
      setFeedback(result.ok ? { ok: true, text: result.message ?? "Έγινε." } : { ok: false, text: result.error });
      if (result.ok) {
        setSelected(new Set());
        router.refresh();
      }
      setConfirming(null);
      setConfirmText("");
    });
  }

  const confirmBytes = (confirming ?? []).reduce((n, k) => n + (byKey.get(k)?.bytes ?? 0), 0);
  const confirmFiles = (confirming ?? []).reduce((n, k) => n + (byKey.get(k)?.files.length ?? 0), 0);
  const needsTyping = (confirming?.length ?? 0) > 1;
  const canConfirm = !needsTyping || confirmText.trim() === String(confirming?.length);

  return (
    <>
      {feedback && (
        <div
          role="status"
          className={`mb-4 rounded-md border px-4 py-2.5 text-sm ${
            feedback.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Χρήση">
          {(
            [
              ["all", "Όλες"],
              ["used", "Σε χρήση"],
              ["unused", "Δεν χρησιμοποιούνται"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={usage === value}
              onClick={() => {
                setUsage(value);
                setShown(PAGE);
              }}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                usage === value ? "bg-ink text-bg" : "text-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          aria-label="Φάκελος"
          value={folder}
          onChange={(e) => {
            setFolder(e.target.value);
            setShown(PAGE);
          }}
          className="rounded-md border border-border bg-bg px-2.5 py-2 text-sm"
        >
          <option value="all">Όλοι οι φάκελοι</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {FOLDERS[f] ?? f}
            </option>
          ))}
        </select>

        <select
          aria-label="Ταξινόμηση"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-md border border-border bg-bg px-2.5 py-2 text-sm"
        >
          <option value="newest">Νεότερες πρώτα</option>
          <option value="oldest">Παλαιότερες πρώτα</option>
          <option value="largest">Μεγαλύτερες πρώτα</option>
        </select>

        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Αναζήτηση (όνομα, προϊόν, κατηγορία…)"
          aria-label="Αναζήτηση εικόνων"
          className="min-w-[14rem] flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
        />
      </div>

      {/* Selection bar */}
      <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm">
        <span className="text-ink-muted">
          {filtered.length} {filtered.length === 1 ? "εικόνα" : "εικόνες"}
          {selected.size > 0 && <span className="text-ink"> · {selected.size} επιλεγμένες</span>}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {deletableInView.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set(deletableInView.map((i) => i.key)))}
              className="rounded-md border border-border px-2.5 py-1.5 font-medium text-ink hover:bg-surface"
            >
              Επιλογή όσων δεν χρησιμοποιούνται ({deletableInView.length})
            </button>
          )}
          {selected.size > 0 && (
            <>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded-md border border-border px-2.5 py-1.5 font-medium text-ink hover:bg-surface"
              >
                Καθαρισμός
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => askDelete([...selected])}
                className="rounded-md border border-danger/40 px-2.5 py-1.5 font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
              >
                Διαγραφή επιλεγμένων
              </button>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-ink-muted">
          Καμία εικόνα με αυτά τα φίλτρα.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.slice(0, shown).map((item) => (
            <MediaCard
              key={item.key}
              item={item}
              selected={selected.has(item.key)}
              onToggle={() => toggle(item.key)}
              onDelete={() => askDelete([item.key])}
              disabled={pending}
            />
          ))}
        </ul>
      )}

      {filtered.length > shown && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface"
          >
            Περισσότερες ({filtered.length - shown} ακόμα)
          </button>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <button
            type="button"
            aria-label="Άκυρο"
            onClick={() => setConfirming(null)}
            className="absolute inset-0 bg-ink/30"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-confirm-title"
            className="relative w-full max-w-md rounded-lg border border-border bg-bg p-6"
          >
            <h2 id="media-confirm-title" className="font-display text-lg text-ink">
              Οριστική διαγραφή
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              {confirming.length === 1
                ? `Η εικόνα «${byKey.get(confirming[0])?.name ?? ""}»`
                : `${confirming.length} εικόνες`}{" "}
              ({confirmFiles} αρχεία, {formatBytes(confirmBytes)}) θα διαγραφούν από την αποθήκη. Δεν αναιρείται.
              Διαγράφονται μόνο εικόνες που δεν χρησιμοποιούνται πουθενά.
            </p>
            {needsTyping && (
              <>
                <label htmlFor="media-confirm-input" className="mt-4 block text-sm text-ink">
                  Πληκτρολόγησε <strong className="tabular-nums">{confirming.length}</strong> για επιβεβαίωση
                </label>
                <input
                  id="media-confirm-input"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoFocus
                  inputMode="numeric"
                  className="mt-1.5 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
                />
              </>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface"
              >
                Άκυρο
              </button>
              <button
                type="button"
                onClick={() => runDelete(confirming)}
                disabled={!canConfirm || pending}
                className="rounded-md bg-danger px-3.5 py-2 text-sm font-medium text-bg transition-colors hover:bg-danger/90 disabled:opacity-40"
              >
                {pending ? "Διαγραφή…" : "Διαγραφή"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MediaCard({
  item,
  selected,
  onToggle,
  onDelete,
  disabled,
}: {
  item: MediaItem;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const unused = item.usages.length === 0;
  const formats = [...new Set(item.files.map((f) => f.format.toUpperCase()))].join(" · ");

  return (
    <li
      className={`flex flex-col overflow-hidden rounded-lg border bg-bg transition-colors ${
        selected ? "border-ink ring-1 ring-ink" : "border-border"
      }`}
    >
      <div className="relative aspect-square bg-surface">
        {item.previewUrl ? (
          <a href={item.originalUrl ?? item.previewUrl} target="_blank" rel="noreferrer" title="Άνοιγμα σε νέα καρτέλα">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin media-library thumbnail, arbitrary stored path (same as ProductImageManager) */}
            <img
              src={item.previewUrl}
              alt={item.altText ?? ""}
              loading="lazy"
              className="h-full w-full object-contain"
            />
          </a>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted">Χωρίς προεπισκόπηση</div>
        )}
        {unused && (
          <label className="absolute left-2 top-2 flex items-center rounded bg-bg/90 p-1 shadow-sm">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              aria-label={`Επιλογή ${item.name}`}
              className="h-4 w-4 accent-ink"
            />
          </label>
        )}
        <span
          className={`absolute right-2 top-2 rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${
            unused ? "bg-accent/10 text-accent" : "bg-success/10 text-success"
          }`}
        >
          {unused ? "Δεν χρησιμοποιείται" : "Σε χρήση"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="truncate text-sm font-medium text-ink" title={item.name}>
          {item.name}
        </div>
        <div className="text-xs text-ink-muted">
          {FOLDERS[item.folder] ?? item.folder} · {formatBytes(item.bytes)} · {dateFmt.format(new Date(item.createdAt))}
        </div>
        <div className="text-[11px] text-ink-muted" title={item.files.map((f) => f.name).join("\n")}>
          {item.files.length} {item.files.length === 1 ? "αρχείο" : "αρχεία"} ({formats})
        </div>

        {!unused && (
          <ul className="mt-1 space-y-0.5 text-xs">
            {item.usages.slice(0, 3).map((u) => (
              <li key={u.label} className="truncate">
                {u.href ? (
                  <Link href={u.href} className="text-ink hover:text-accent" title={u.label}>
                    {u.label}
                  </Link>
                ) : (
                  <span className="text-ink">{u.label}</span>
                )}
              </li>
            ))}
            {item.usages.length > 3 && (
              <li className="text-ink-muted" title={item.usages.slice(3).map((u) => u.label).join("\n")}>
                +{item.usages.length - 3} ακόμα
              </li>
            )}
          </ul>
        )}

        {unused && (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="mt-auto self-start rounded-md border border-danger/40 px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
          >
            Διαγραφή
          </button>
        )}
      </div>
    </li>
  );
}
