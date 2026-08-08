// Small, hand-rolled validators — no new dependency for a handful of simple
// checks (CHECKOUT_UX_SPEC.md §12 wants inline, per-field Greek errors, not
// a validation library's generic English ones).

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Greek landline/mobile numbers are 10 digits (mobile starts 69, landlines
// vary by area code) — loose on purpose, just strips spaces/dashes and
// checks length+digits rather than trying to validate real area codes.
export function isValidPhone(value: string): boolean {
  return /^\d{10}$/.test(value.replace(/[\s-]/g, ""));
}

export function isValidPostalCode(value: string): boolean {
  return /^\d{5}$/.test(value.trim());
}

export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}
