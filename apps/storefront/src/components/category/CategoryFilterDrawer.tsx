"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { currentQuery } from "@/lib/current-query";
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
import { clearedFilterUrl, filterDraftUrl, type CategoryFilterOptions } from "@/lib/category-filter";
import { markScrollToProducts } from "@/lib/scroll-to-products";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const EXIT_TRANSITION_MS = 300;

// Mobile-only entry point: a "Φίλτρα (N)" button that opens a bottom sheet.
// Changes are staged locally and only reach the URL on "Εφαρμογή φίλτρων" —
// batches every checkbox tap into one navigation instead of one per tap.
export function CategoryFilterDrawer({
  facets,
  filters,
  categoryFilter,
}: {
  facets: CategoryFacets;
  filters: CategoryFilters;
  categoryFilter?: CategoryFilterOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterDraft>(() => filtersToDraft(filters, categoryFilter));

  if (!hasAnyFacet(facets, categoryFilter)) return null;

  const activeCount = countActiveFilters(filters);

  function openDrawer() {
    setDraft(filtersToDraft(filters, categoryFilter));
    setOpen(true);
  }

  // The result opens where the products start, not at the top of the page
  // (ScrollToProducts in CategoryPLPView does the scrolling).
  function go(url: string) {
    markScrollToProducts();
    router.push(url, { scroll: false });
    setOpen(false);
  }

  function apply() {
    go(filterDraftUrl(pathname, currentQuery(), draft, categoryFilter));
  }

  function clearAndApply() {
    setDraft({ ...EMPTY_DRAFT, categories: categoryFilter?.mode === "siblings" ? categoryFilter.selected : [] });
    go(clearedFilterUrl(pathname, currentQuery()));
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
          categoryFilter={categoryFilter}
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
  categoryFilter,
  draft,
  onChange,
  onApply,
  onClear,
  onClose,
  draftCount,
}: {
  facets: CategoryFacets;
  categoryFilter?: CategoryFilterOptions;
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
        // svh, not vh, for the same reason as the search dropdown's cap: `vh`
        // is the LARGE viewport — the one with the mobile browser's chrome
        // retracted — so a cap written against it can exceed what is actually
        // on screen while the toolbar is showing. `svh` is the small
        // viewport, the part that is always visible, which is the
        // conservative number a "never taller than" cap wants. Identical on
        // desktop, where there is no dynamic toolbar for the two to differ
        // by. Note this bounds the sheet's HEIGHT; it is still anchored
        // bottom-0 to the fixed layer, so whether the Καθαρισμός/Εφαρμογή row
        // can ever sit under an iOS toolbar is a separate question that only
        // a real device can answer.
        className={`absolute inset-x-0 bottom-0 flex max-h-[85svh] flex-col rounded-t-lg bg-bg shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
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
          <CategoryFilterFields
            facets={facets}
            draft={draft}
            onChange={onChange}
            categoryFilter={categoryFilter}
            // «← parent» navigates straight away; close without the exit
            // animation so the sheet is not left over the new page.
            onNavigate={onClose}
          />
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
