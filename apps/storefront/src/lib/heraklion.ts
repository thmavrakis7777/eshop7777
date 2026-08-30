import { normalizeSearchText } from "@/lib/search";

/**
 * Genuine Heraklion (city + wider delivery area) detection for the
 * heraklion_only shipping method — server-side only, since it gates a real
 * price and must never trust anything the client asserts about itself.
 *
 * City text is free-typed (no dropdown — see checkout-form-state.ts), so this
 * has to tolerate whatever spelling/casing/accents a customer actually types:
 * "Ηράκλειο", "ΗΡΑΚΛΕΙΟ", "Ηρακλειο", "Heraklion", "Iraklio", ...
 * normalizeSearchText already strips tonos accents, lowercases, and folds
 * final-sigma — exactly the Greek-text fold this needs — so only the Latin
 * transliterations need listing explicitly.
 */
const HERAKLION_CITY_ALIASES = new Set(
  ["ηρακλειο", "ηρακλειο κρητης", "heraklion", "heraklio", "iraklio", "irakleio", "iraklion"].map(
    normalizeSearchText
  )
);

/**
 * Supporting signal only (per spec) — deliberately NOT the requested
 * "71xxx and 72xxx" range. Real Hellenic Post prefixes: the Heraklion
 * prefecture runs 700xx-716xx; 720xx+ is Lasithi, a different prefecture
 * (Agios Nikolaos, Sitia, Ierapetra, ...) and would misclassify those
 * deliveries as Heraklion if included. See final report for sourcing.
 */
function isHeraklionPostalCode(postalCode: string | null | undefined): boolean {
  if (!postalCode) return false;
  const trimmed = postalCode.trim();
  if (!/^\d{5}$/.test(trimmed)) return false;
  const prefix = Number(trimmed.slice(0, 3));
  return prefix >= 700 && prefix <= 716;
}

export function isHeraklionAddress(
  address: { city?: string | null; postal_code?: string | null } | null | undefined
): boolean {
  if (!address) return false;
  const city = normalizeSearchText(address.city ?? "");
  if (city && HERAKLION_CITY_ALIASES.has(city)) return true;
  return isHeraklionPostalCode(address.postal_code);
}
