"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import { SearchIcon } from "@/components/ui/Icons";
import { searchProductsPreviewAction } from "@/lib/actions/search";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

// Live-results dropdown backed by Medusa's own `q` search (title + variant
// SKU together — see PRODUCT_CODE_AND_ADD_TO_CART_SPEC.md §1.4), plus a
// dedicated /anazitisi results page on submit. No separate search
// index/service — just the same Store API every other product list uses.
export function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const trimmed = query.trim();
    // Below the threshold, just cancel any pending fetch — no state to
    // reset here, the render below already hides the dropdown for a query
    // this short regardless of what's left over in `results`/`isOpen`.
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return;
    }

    const currentRequestId = ++requestId.current;
    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true);
      const products = await searchProductsPreviewAction(trimmed);
      // Ignore stale responses from an earlier keystroke that resolved late.
      if (currentRequestId !== requestId.current) return;
      setResults(products);
      setIsOpen(true);
      setIsLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  function goToResultsPage() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsOpen(false);
    onNavigate?.();
    router.push(`/anazitisi?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToResultsPage();
        }}
        className="flex items-center gap-3 rounded-md border border-border px-4 py-2.5 focus-within:border-accent"
      >
        <SearchIcon className="h-4 w-4 shrink-0 text-ink-muted" />
        <label htmlFor="site-search" className="sr-only">
          Αναζήτηση προϊόντων με όνομα ή κωδικό
        </label>
        <input
          id="site-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Αναζήτησε π.χ. τηγάνι, κατσαρόλα, ή κωδικό προϊόντος..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-muted"
          autoFocus
          autoComplete="off"
        />
      </form>

      {/* The dropdown appears and changes silently for a screen-reader user —
          results are only discoverable by tabbing forward and finding them.
          This announces the outcome of each debounced search instead. */}
      <p role="status" aria-live="polite" className="sr-only">
        {isOpen && query.trim().length >= MIN_QUERY_LENGTH && !isLoading
          ? results.length === 0
            ? "Δεν βρέθηκαν προϊόντα."
            : `${results.length} αποτελέσματα αναζήτησης.`
          : ""}
      </p>

      {isOpen && query.trim().length >= MIN_QUERY_LENGTH && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-md border border-border bg-bg shadow-lg">
          {isLoading ? (
            <p className="px-4 py-4 text-sm text-ink-muted">Αναζήτηση…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-muted">Δεν βρέθηκαν προϊόντα.</p>
          ) : (
            <>
              <ul>
                {results.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/proionta/${product.handle}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface transition-colors"
                      onClick={() => {
                        setIsOpen(false);
                        onNavigate?.();
                      }}
                    >
                      <PlaceholderTile
                        label={product.title}
                        tone={product.placeholderTone}
                        className="h-12 w-12 shrink-0"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm text-ink">{product.title}</span>
                        <span className="text-xs text-ink-muted">{formatPrice(product.price)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={goToResultsPage}
                className="block w-full border-t border-border px-4 py-3 text-left text-sm font-medium text-accent hover:underline"
              >
                Δες όλα τα αποτελέσματα για «{query.trim()}» →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
