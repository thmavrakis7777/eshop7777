"use client";

import { useEffect, useRef, useState } from "react";
import {
  resolveProductTitlesAction,
  searchProductsForPickerAction,
  type ProductPickerHit,
} from "@/lib/admin/catalog-actions";

/**
 * Search-and-pick products by name, in a chosen order.
 *
 * Replaces the raw "one slug per line" textarea for a manual product rail:
 * the owner should never have to know what a slug is, or copy one out of a
 * URL, to say "show these six products".
 *
 * Selection is submitted as a single hidden input (newline-separated slugs)
 * so the existing Server Action parsing is unchanged — this is a UI upgrade
 * over the same wire format, not a new contract.
 */
export function ProductPicker({
  name,
  defaultSlugs,
}: {
  name: string;
  defaultSlugs: string[];
}) {
  const [selected, setSelected] = useState<ProductPickerHit[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductPickerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Resolve stored slugs to real titles on mount, so an existing selection
  // shows product names rather than the slugs that were saved.
  useEffect(() => {
    if (defaultSlugs.length === 0) return;
    let cancelled = false;
    resolveProductTitlesAction(defaultSlugs).then((rows) => {
      if (!cancelled) setSelected(rows);
    });
    return () => {
      cancelled = true;
    };
    // defaultSlugs is the initial value only — re-running on every render
    // would fight the user's own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search. 250ms matches the storefront's own search box.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        setHits(await searchProductsForPickerAction(query));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open]);

  // Close the results panel on an outside click, like a native combobox.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const selectedSlugs = new Set(selected.map((s) => s.slug));

  function add(hit: ProductPickerHit) {
    if (selectedSlugs.has(hit.slug)) return;
    setSelected((prev) => [...prev, hit]);
    setQuery("");
  }

  function remove(slug: string) {
    setSelected((prev) => prev.filter((p) => p.slug !== slug));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= selected.length) return;
    setSelected((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {/* The real submitted value — the visible UI is all presentation. */}
      <input type="hidden" name={name} value={selected.map((s) => s.slug).join("\n")} />

      {selected.length > 0 && (
        <ol className="flex flex-col gap-1">
          {selected.map((p, i) => (
            <li
              key={p.slug}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
            >
              <span className="w-5 shrink-0 text-center text-xs tabular-nums text-ink-muted">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.title}</span>
              {p.categoryName && (
                <span className="hidden shrink-0 text-xs text-ink-muted sm:inline">
                  {p.categoryName}
                </span>
              )}
              <button
                type="button"
                aria-label={`Μετακίνηση πάνω: ${p.title}`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="h-6 w-6 shrink-0 rounded-sm border border-border text-ink disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Μετακίνηση κάτω: ${p.title}`}
                disabled={i === selected.length - 1}
                onClick={() => move(i, 1)}
                className="h-6 w-6 shrink-0 rounded-sm border border-border text-ink disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Αφαίρεση: ${p.title}`}
                onClick={() => remove(p.slug)}
                className="shrink-0 rounded-sm px-1.5 py-0.5 text-xs text-danger hover:bg-danger/5"
              >
                Αφαίρεση
              </button>
            </li>
          ))}
        </ol>
      )}

      <div ref={boxRef} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Αναζήτησε προϊόν για προσθήκη…"
          aria-label="Αναζήτηση προϊόντος"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink"
        />

        {open && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-bg shadow-lg">
            {loading && <p className="px-3 py-2 text-xs text-ink-muted">Αναζήτηση…</p>}
            {!loading && hits.length === 0 && (
              <p className="px-3 py-2 text-xs text-ink-muted">Κανένα προϊόν.</p>
            )}
            {hits.map((hit) => {
              const already = selectedSlugs.has(hit.slug);
              return (
                <button
                  key={hit.slug}
                  type="button"
                  disabled={already}
                  onClick={() => add(hit)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface disabled:opacity-40"
                >
                  <span className="min-w-0 truncate">{hit.title}</span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {already ? "Επιλεγμένο" : (hit.categoryName ?? "")}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        {selected.length === 0
          ? "Δεν έχεις επιλέξει προϊόντα ακόμα."
          : `${selected.length} προϊόντα, με τη σειρά που θα εμφανίζονται.`}
      </p>
    </div>
  );
}
