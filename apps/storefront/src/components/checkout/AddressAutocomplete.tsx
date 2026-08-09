"use client";

import { useEffect, useRef, useState } from "react";
import {
  getAddressSuggestions,
  getPlaceDetails,
  type AddressSuggestion,
  type ParsedAddressDetails,
} from "@/lib/actions/address-autocomplete";

// Wraps the plain "Οδός" text input with a live suggestions dropdown —
// never replaces manual entry (CHECKOUT_PREMIUM_SPEC.md §2's hard
// requirement): typing always updates the field directly via `onChange`
// exactly like a plain FormField, the dropdown is purely additive, and if
// GOOGLE_PLACES_API_KEY isn't configured (or a call fails) the Server
// Actions just return no suggestions — this degrades to a completely
// ordinary text field with no error state, not a broken feature.
export function AddressAutocomplete({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  onAddressSelected,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  onAddressSelected: (details: ParsedAddressDetails) => void;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // One session token per address-entry session, per Google's session
  // billing model (the point of the whole session-token mechanism —
  // without it, every keystroke bills as a separate request instead of one
  // session that ends in a Place Details call). Regenerated after a
  // selection completes a session, not on every render.
  const sessionToken = useRef(crypto.randomUUID());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // Closes the dropdown on outside click — a suggestions list that stays
  // open after the customer clicks elsewhere is a real usability nit, same
  // bar as the search preview dropdown this pattern is modeled on.
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

  function handleChange(newValue: string) {
    onChange(newValue);
    setActiveIndex(-1);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (newValue.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      const results = await getAddressSuggestions(newValue, sessionToken.current);
      setSuggestions(results);
      setIsOpen(results.length > 0);
    }, 300);
  }

  async function handleSelect(suggestion: AddressSuggestion) {
    setIsOpen(false);
    setSuggestions([]);
    onChange(suggestion.mainText || value);

    const details = await getPlaceDetails(suggestion.placeId, sessionToken.current);
    if (details) onAddressSelected(details);

    // Session is over once a place is resolved — a fresh token starts the
    // next one, matching Google's session-token contract.
    sessionToken.current = crypto.randomUUID();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      void handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // A short delay so a click on a suggestion (which also blurs the
          // input) registers before the dropdown unmounts — otherwise the
          // mousedown-outside handler and the blur race and the click is
          // lost.
          setTimeout(() => setIsOpen(false), 150);
          onBlur?.();
        }}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        autoComplete="address-line1"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-11 rounded-sm border border-border px-3 text-sm text-ink outline-none focus:border-accent"
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {isOpen && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute top-full z-20 mt-1 w-full rounded-sm border border-border bg-bg py-1 shadow-md"
        >
          {suggestions.map((s, i) => (
            <li key={s.placeId} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void handleSelect(s)}
                className={`flex w-full flex-col px-3 py-2 text-left text-sm ${
                  i === activeIndex ? "bg-surface" : ""
                }`}
              >
                <span className="text-ink">{s.mainText}</span>
                {s.secondaryText && <span className="text-xs text-ink-muted">{s.secondaryText}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
