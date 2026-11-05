/**
 * EAN / GTIN barcodes (migration 0046): the number printed under a product's
 * barcode. EAN-8, UPC-A (12 digits), EAN-13 and GTIN-14 all end in a check
 * digit computed the same way, so one rule validates every length.
 */

/** Digits only, as typed or scanned: spaces and dashes are dropped. */
export function normalizeEan(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/**
 * True for a well-formed GTIN: 8, 12, 13 or 14 digits whose last digit is the
 * standard check digit (weights 3,1,3,1… counted from the right, before it).
 */
export function isValidEan(code: string): boolean {
  if (!/^([0-9]{8}|[0-9]{12,14})$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
