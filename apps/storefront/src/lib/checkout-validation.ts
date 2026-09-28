// Small, hand-rolled validators — no new dependency for a handful of simple
// checks (CHECKOUT_UX_SPEC.md §12 wants inline, per-field Greek errors, not
// a validation library's generic English ones).

import { normalizePhone, normalizePostalCode } from "@/lib/address-format";

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Greek landline/mobile numbers are 10 digits (mobile starts 69, landlines
// vary by area code) — loose on purpose, just checks length+digits rather
// than trying to validate real area codes. normalizePhone first, so a number
// autofilled as "+30 694 123 4567" passes instead of being rejected (A2).
export function isValidPhone(value: string): boolean {
  return /^\d{10}$/.test(normalizePhone(value));
}

// "712 01" passes too (A3) — callers store normalizePostalCode's output.
export function isValidPostalCode(value: string): boolean {
  return /^\d{5}$/.test(normalizePostalCode(value));
}

export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidPassword(value: string): boolean {
  return value.length >= 8;
}

// Standard Greek ΑΦΜ checksum (the same publicly-documented mod-11 formula
// used across Greek tax-ID validators): the last of the 9 digits is a check
// digit computed from the first 8, weighted by descending powers of 2, mod
// 11, mod 10. Checksum only — this does NOT verify the ΑΦΜ is a real,
// registered business (that needs a live lookup, CHECKOUT_PREMIUM_SPEC.md
// §4.3, a later phase), only that it's a structurally valid number.
// A same-site path only — validates a `?redirectTo=` query param before it's
// ever handed to redirect()/router.push(). Rejects an absolute URL (another
// origin) AND a protocol-relative "//evil.com" (which also starts with "/"
// but browsers resolve it as an absolute URL to a different origin) — same
// distinction lib/admin/nav-actions.ts's safeCustomHref draws for admin nav
// links, minus that function's extra allowance for legitimate external URLs,
// which a post-login redirect must never follow.
export function isSafeRedirectPath(value: string | null | undefined): value is string {
  return !!value && value.startsWith("/") && !value.startsWith("//");
}

// Carries a post-login destination across the login ↔ register links, so a
// shopper who arrives from checkout's "Σύνδεση" and then picks "Δημιουργία
// λογαριασμού" still lands back in checkout (CHECKOUT_PREFILL_GOOGLE_SPEC.md
// §2.5). The default destination (/logariasmos) is left off the URL.
export function withRedirectTo(path: string, redirectTo: string): string {
  return isSafeRedirectPath(redirectTo) && redirectTo !== "/logariasmos"
    ? `${path}?redirectTo=${encodeURIComponent(redirectTo)}`
    : path;
}

export function isValidAFM(value: string): boolean {
  const digits = value.trim();
  if (!/^\d{9}$/.test(digits) || digits === "000000000") return false;

  const nums = digits.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += nums[i] * Math.pow(2, 8 - i);
  }
  const checkDigit = (sum % 11) % 10;
  return checkDigit === nums[8];
}
