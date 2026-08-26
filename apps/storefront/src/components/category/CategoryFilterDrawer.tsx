"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CategoryFilterFields,
  EMPTY_DRAFT,
  countDraft,
  filtersToDraft,
  hasAnyFacet,
  type FilterDraft,
} from "@/components/category/CategoryFilterFields";
import { countActiveFilters } from "@/lib/search-params";
import { FilterIcon, CloseIcon } from "@/components/ui/Icons";
import type { CategoryFacets, CategoryFilters } from "@/lib/data/products";

const FILTER_KEYS = ["price_min", "price_max", "in_stock", "material", "origin"];
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const EXIT_TRANSITION_MS = 300;

function draftToParams(base: URLSearchParams, draft: FilterDraft): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const k of FILTER_KEYS) params.delete(k);
  if (draft.priceMin) params.set("price_min", draft.priceMin);
  if (draft.priceMax) params.set("price_max", draft.priceMax);
  if (draft.inStock) params.set("in_stock", "1");
  for (const m of draft.material) params.append("material", m);
  for (const o of draft.origin) params.append("origin", o);
  params.delete("page");
  return params;
}

// Mobile-only entry point: a "Φίλτρα (N)" button that opens a bottom sheet.
// Changes are staged locally and only reach the URL on "Εφαρμογή φίλτρων" —
// batches every checkbox tap into one navigation instead of one per tap.
export function CategoryFilterDrawer({ facets, filters }: { facets: CategoryFacets; filters: CategoryFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterDraft>(() => filtersToDraft(filters));

  if (!hasAnyFacet(facets)) return null;

  const activeCount = countActiveFilters(filters);

  function openDrawer() {
    setDraft(filtersToDraft(filters));
    setOpen(true);
  }

  function apply() {
    const params = draftToParams(searchParams, draft);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  }

  function clearAndApply() {
    setDraft(EMPTY_DRAFT);
    const params = new URLSearchParams(searchParams);
    for (const k of FILTER_KEYS) params.delete(k);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-2 text-sm font-medium text-ink lg:hidden"
      >
        <FilterIcon className="h-4 w-4" />
        Φίλτρα{activeCount > 0 && ` (${activeCount})`}
      </button>

      {open && (
        <FilterSheet
          facets={facets}
          draft={draft}
          onChange={setDraft}
          onApply={apply}
          onClear={clearAndApply}
          onClose={() => setOpen(false)}
          draftCount={countDraft(draft)}
        />
      )}
    </>
  );
}

function FilterSheet({
  facets,
  draft,
  onChange,
  onApply,
  onClear,
  onClose,
  draftCount,
}: {
  facets: CategoryFacets;
  draft: FilterDraft;
  onChange: (next: FilterDraft) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
  draftCount: number;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, []);

  function requestClose() {
    setVisible(false);
    setClosing(true);
  }

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onClose, EXIT_TRANSITION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        requestClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, []);

  return createPortal(
    <div ref={dialogRef} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Φίλτρα προϊόντων">
      <div
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
        onClick={requestClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-lg bg-bg shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-lg">Φίλτρα</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="p-2"
            aria-label="Κλείσιμο φίλτρων"
            onClick={requestClose}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <CategoryFilterFields facets={facets} draft={draft} onChange={onChange} />
        </div>

        <div className="flex items-center gap-3 border-t border-border p-4">
          <button
            type="button"
            onClick={onClear}
            className="flex-1 rounded-sm border border-border px-4 py-3 text-sm font-medium text-ink hover:bg-surface"
          >
            Καθαρισμός
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex-1 rounded-sm bg-ink px-4 py-3 text-sm font-medium tracking-wide text-white hover:bg-accent"
          >
            Εφαρμογή φίλτρων{draftCount > 0 && ` (${draftCount})`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
