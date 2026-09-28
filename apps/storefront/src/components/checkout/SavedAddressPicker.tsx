"use client";

import type { CustomerAddress } from "@/lib/types";

export const NEW_ADDRESS = "new";

// Only rendered for a signed-in customer with two or more saved addresses
// (CHECKOUT_PREFILL_GOOGLE_SPEC.md §2.3) — with one, the form is already
// filled from it and there's nothing to choose. A native <select> styled
// like the form's text fields: no new visual pattern, and the phone's own
// picker on mobile.
export function SavedAddressPicker({
  addresses,
  selectedId,
  onSelect,
}: {
  addresses: CustomerAddress[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="checkout-saved-address" className="text-xs font-medium text-ink-muted">
        Αποθηκευμένη διεύθυνση
      </label>
      <select
        id="checkout-saved-address"
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="h-11 rounded-sm border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-accent"
      >
        {addresses.map((a) => (
          <option key={a.id} value={a.id}>
            {[a.label, `${[a.street, a.number].filter(Boolean).join(" ")}, ${a.city} ${a.postalCode}`]
              .filter(Boolean)
              .join(" · ")}
          </option>
        ))}
        <option value={NEW_ADDRESS}>Νέα διεύθυνση</option>
      </select>
    </div>
  );
}
