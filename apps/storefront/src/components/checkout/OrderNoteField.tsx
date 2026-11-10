"use client";

import { ORDER_NOTE_MAX_LENGTH } from "@/lib/order-note";

/**
 * «Σχόλια παραγγελίας (προαιρετικό)» — the last field before the place-order
 * button, so a customer can tell the shop what the address alone cannot
 * (κουδούνι, όροφος, ώρα). Sent with the order itself (lib/order-note.ts);
 * the owner sees it on the admin order page and in the new-order email.
 * Same look as FormField's inputs.
 */
export function OrderNoteField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="order-note" className="text-xs font-medium text-ink-muted">
        Σχόλια παραγγελίας (προαιρετικό)
      </label>
      <textarea
        id="order-note"
        rows={3}
        value={value}
        maxLength={ORDER_NOTE_MAX_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        placeholder="π.χ. κουδούνι, όροφος, ώρα που είστε διαθέσιμοι"
        className="rounded-sm border border-border px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
      />
    </div>
  );
}
