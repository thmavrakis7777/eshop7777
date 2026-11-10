/**
 * «Σχόλια παραγγελίας» — the customer's optional free-text note at checkout
 * (e.g. «κουδούνι Παπαδάκης, 2ος όροφος»). orders.customer_note existed from
 * the start and the admin was meant to show it, but checkout never had a
 * field to fill it in (found on test order #1031, 2026-11-10).
 *
 * The note travels with the place-order call rather than being saved to the
 * cart as the customer types: it is read once, by the owner, and needs no
 * column, autosave or migration on the cart.
 *
 * Shared by the textarea's maxLength and the server's own check — the
 * server action is a public endpoint, so it must not trust the browser's
 * limit.
 */
export const ORDER_NOTE_MAX_LENGTH = 500;

/**
 * Trimmed, control characters removed (line breaks kept, at most one blank
 * line in a row), capped at ORDER_NOTE_MAX_LENGTH. Empty becomes null, so an
 * order without a note stores NULL rather than "".
 */
export function normalizeOrderNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, ORDER_NOTE_MAX_LENGTH)
    .trim();
  return cleaned === "" ? null : cleaned;
}
