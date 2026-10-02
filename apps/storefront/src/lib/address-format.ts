// The shapes Greek addresses and phone numbers actually arrive in — typed by
// hand, filled in by Chrome/Safari autofill, or read back from a saved
// address — cleaned up the same way at every entry point, so "712 01" and
// "71201", or "+30 694 123 4567" and "6941234567", are the same value
// everywhere they're compared or stored (CHECKOUT_PREFILL_GOOGLE_SPEC.md §2.6).

// A house number the way Greek addresses write it: digits, optionally one
// letter ("12Α", "12 Α"), optionally a range or a second number ("25-27",
// "3/5"). Greek and Latin letters are spelled out as ranges rather than
// \p{L}: the project compiles to ES2017, which has no Unicode property
// escapes.
const LETTER = "[A-Za-z\\u0370-\\u03FF\\u1F00-\\u1FFF]";
const NUMBER_TOKEN = `\\d+(?:\\s?${LETTER})?`;
const TRAILING_HOUSE_NUMBER = new RegExp(`^(.*?\\S)\\s+(${NUMBER_TOKEN}(?:\\s?[-–/]\\s?${NUMBER_TOKEN})?)$`);

/**
 * Splits "Οδός Αριθμός" back into the checkout's two fields: "Ικάρου 25" →
 * Ικάρου | 25, "28ης Οκτωβρίου 12Α" → 28ης Οκτωβρίου | 12Α. With no trailing
 * number the whole line stays in `street`.
 *
 * Only ever used to *fill* the form — from a saved address, the cart's own
 * address, or an autofilled "address-line1" — never to decide what's stored.
 * Every save joins the two fields back with one space
 * (lib/actions/checkout.ts), so even a wrong guess (a street genuinely named
 * "Πλατεία 1866") stores exactly the text the customer sees; the split only
 * decides which box each half shows in.
 */
export function splitStreetAndNumber(line: string): { street: string; number: string } {
  const trimmed = line.trim().replace(/\s+/g, " ");
  const match = TRAILING_HOUSE_NUMBER.exec(trimmed);
  return match ? { street: match[1], number: match[2] } : { street: trimmed, number: "" };
}

/**
 * A Greek number as the 10 digits couriers and SMS need. Accepts what
 * autofill and phone contacts really hold — "+30 694 123 4567",
 * "0030 6941234567", "(2810) 751-814", "694.123.4567" — instead of rejecting
 * it and making the customer retype their own number. Anything that isn't a
 * Greek number comes back with only the separators removed, so validation
 * still rejects it rather than it being silently rewritten.
 */
export function normalizePhone(value: string): string {
  const compact = value.replace(/[\s\-.()]/g, "");
  if (/^\+30\d{10}$/.test(compact)) return compact.slice(3);
  if (/^0030\d{10}$/.test(compact)) return compact.slice(4);
  return compact;
}

/** "712 01" (how Greek postal codes are commonly written) → "71201". */
export function normalizePostalCode(value: string): string {
  return value.replace(/\s/g, "");
}

/**
 * Whether two address lines + ΤΚ are the same place, ignoring case, spacing
 * and the ΤΚ's optional space — used to skip saving a duplicate into the
 * address book, and to tell whether the checkout's address is already there.
 */
export function isSameAddressLine(
  a: { line: string; postalCode: string },
  b: { line: string; postalCode: string }
): boolean {
  const fold = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("el");
  return fold(a.line) === fold(b.line) && normalizePostalCode(a.postalCode) === normalizePostalCode(b.postalCode);
}

/**
 * The store's own address (Settings → contactAddress, one free-text field)
 * as schema.org PostalAddress parts, for the store's JSON-LD (lib/maps.ts).
 *
 * Reads only the two shapes that leave no doubt where each part starts —
 * "ΣΦΑΚΙΑΝΑΚΗ 4, 71201, Ηράκλειο Κρήτης" and "ΣΦΑΚΙΑΝΑΚΗ 4, 712 01 Ηράκλειο":
 * a street ending in a house number, a 5-digit ΤΚ, then a town with no
 * digits in it. Anything else returns null and the caller publishes the whole
 * text as streetAddress, as it always did — a guessed split could publish a
 * wrong street or town to search engines, which is worse than an undivided
 * but correct line (the same rule parseOpeningHours follows for the hours).
 * The town stays exactly as typed: cutting "Ηράκλειο Κρήτης" into locality +
 * region would be one more guess.
 */
export function parseStoreAddress(
  text: string
): { streetAddress: string; postalCode: string; addressLocality: string } | null {
  const parts = text
    .split(/[,\n]/)
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  let street: string;
  let postal: string;
  let town: string;
  if (parts.length === 3) {
    [street, postal, town] = parts;
  } else if (parts.length === 2) {
    // "71201 Ηράκλειο" / "712 01 Ηράκλειο" — ΤΚ and town in one part.
    const match = /^(\d{3} ?\d{2}) (.+)$/.exec(parts[1]);
    if (!match) return null;
    [street, postal, town] = [parts[0], match[1], match[2]];
  } else {
    return null;
  }

  const postalCode = normalizePostalCode(postal);
  if (!splitStreetAndNumber(street).number || !/^\d{5}$/.test(postalCode) || /\d/.test(town)) return null;
  return { streetAddress: street, postalCode, addressLocality: town };
}
