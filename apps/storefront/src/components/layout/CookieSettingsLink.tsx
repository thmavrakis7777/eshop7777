"use client";

import { requestSettingsOpen } from "@/lib/consent-storage";

/**
 * Permanent footer control that reopens ConsentBanner — a real, always-
 * present way to change your cookie choice later, not just on first visit.
 * A <button>, not a <Link>: it doesn't navigate anywhere, it toggles UI
 * state on the page you're already on.
 */
export function CookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={() => requestSettingsOpen(true)}
      className="underline underline-offset-2 hover:text-ink"
    >
      Ρυθμίσεις Cookies
    </button>
  );
}
