"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { SearchIcon } from "@/components/ui/Icons";
import { SearchResultRow } from "@/components/layout/SearchResultRow";
import { searchProductsPreviewAction } from "@/lib/actions/search";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;
const LISTBOX_ID = "search-listbox";

// Live-results dropdown backed by lib/search.ts's Greek-aware ranked search
// (see lib/data/products.ts's searchProducts()) — the same function powering
// the full /anazitisi results page, not a second search implementation.
// Combobox keyboard pattern mirrors AddressAutocomplete.tsx (role, virtual
// aria-activedescendant navigation via arrow keys, real Tab flow into each
// row's own focusable controls) rather than inventing a new one.
export function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim();
  const belowMinLength = trimmedQuery.length < MIN_QUERY_LENGTH;

  // Below the threshold there's nothing to show — reset synchronously during
  // render (React's documented "adjust state during render" pattern, same
  // one used for CartDrawer's mount/exit flags) rather than an effect, so a
  // stray dropdown from a query the customer just backspaced out of never
  // lingers for a render.
  if (belowMinLength && (isOpen || isLoading || results.length > 0 || activeIndex !== -1)) {
    setIsOpen(false);
    setIsLoading(false);
    setResults([]);
    setActiveIndex(-1);
  }

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (belowMinLength) return;

    const currentRequestId = ++requestId.current;
    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true);
      const products = await searchProductsPreviewAction(trimmedQuery);
      // Ignore a response for a keystroke that's since been superseded —
      // request B (a longer, more specific query) can resolve before an
      // earlier, shorter request A that's still in flight.
      if (currentRequestId !== requestId.current) return;
      setResults(products);
      setIsOpen(true);
      setIsLoading(false);
      setActiveIndex(-1);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [trimmedQuery, belowMinLength]);

  // Closes on outside click — same pattern as AddressAutocomplete, and the
  // same real usability bar: a results list that stays open after the
  // customer clicks elsewhere in the page is a genuine nit, not a nice-to-have.
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function goToResultsPage() {
    if (!trimmedQuery) return;
    setIsOpen(false);
    onNavigate?.();
    router.push(`/anazitisi?q=${encodeURIComponent(trimmedQuery)}`);
  }

  function goToProduct(product: Product) {
    setIsOpen(false);
    onNavigate?.();
    router.push(`/proionta/${product.handle}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
      return;
    }
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      goToProduct(results[activeIndex]);
    }
  }

  const showDropdown = isOpen && !belowMinLength;
  const showSkeleton = isLoading && results.length === 0;
  const showNoResults = !isLoading && results.length === 0;

  return (
    <div ref={containerRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToResultsPage();
        }}
        className="flex items-center gap-3 rounded-md border border-border px-4 py-2.5 focus-within:border-accent"
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-ink-muted"
          />
        ) : (
          <SearchIcon className="h-4 w-4 shrink-0 text-ink-muted" />
        )}
        <label htmlFor="site-search" className="sr-only">
          Αναζήτηση προϊόντων με όνομα ή κωδικό
        </label>
        <input
          id="site-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Αναζήτησε π.χ. τηγάνι, κατσαρόλα, ή κωδικό προϊόντος..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-muted"
          autoFocus
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls={LISTBOX_ID}
          aria-activedescendant={activeIndex >= 0 ? `${LISTBOX_ID}-option-${activeIndex}` : undefined}
        />
      </form>

      {/* Silent visually — announces the outcome of each debounced search for
          a screen-reader user, since the dropdown's appearance otherwise has
          no other cue. */}
      <p role="status" aria-live="polite" className="sr-only">
        {showDropdown && !isLoading
          ? results.length === 0
            ? `Δεν βρέθηκαν προϊόντα για «${trimmedQuery}».`
            : `${results.length} αποτελέσματα αναζήτησης.`
          : ""}
      </p>

      {showDropdown && (
        <div
          id={LISTBOX_ID}
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-md border border-border bg-bg shadow-lg"
        >
          {showSkeleton ? (
            <div className="flex flex-col gap-1 px-3 py-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <div className="h-11 w-11 shrink-0 animate-pulse rounded-md bg-surface" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="h-3 w-2/3 animate-pulse rounded-sm bg-surface" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded-sm bg-surface" />
                  </div>
                </div>
              ))}
            </div>
          ) : showNoResults ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-ink">Δεν βρήκαμε προϊόντα για «{trimmedQuery}»</p>
              <p className="mt-1 text-xs text-ink-muted">
                Δοκίμασε διαφορετική αναζήτηση ή έλεγξε την ορθογραφία.
              </p>
            </div>
          ) : (
            <>
              <ul role="listbox" className={`divide-y divide-border ${isLoading ? "opacity-60" : ""}`}>
                {results.map((product, i) => (
                  <SearchResultRow
                    key={product.id}
                    product={product}
                    optionId={`${LISTBOX_ID}-option-${i}`}
                    active={i === activeIndex}
                    onNavigate={() => {
                      setIsOpen(false);
                      onNavigate?.();
                    }}
                  />
                ))}
              </ul>
              <button
                type="button"
                onClick={goToResultsPage}
                className="block w-full border-t border-border px-4 py-3 text-left text-sm font-medium text-accent hover:underline"
              >
                Δες όλα τα αποτελέσματα για «{trimmedQuery}» →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
