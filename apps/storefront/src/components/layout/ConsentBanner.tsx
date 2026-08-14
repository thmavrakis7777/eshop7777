"use client";

import { useSyncExternalStore } from "react";
import { getConsentServerSnapshot, getConsentSnapshot, setConsentChoice, subscribeConsent } from "@/lib/consent-storage";
import { hasAnyAnalyticsService, type AnalyticsSettings } from "@/lib/content-types";

// Admin-first platform, Phase K. Only ever renders if at least one
// tracking service is actually configured (nothing to consent to
// otherwise) and no choice has been stored yet. AnalyticsScripts reads the
// same consent-storage value to decide whether to inject anything — this
// banner and that injector never talk to each other directly, they just
// share the one localStorage-backed store, same shape as
// Wishlist/wishlist-storage.
export function ConsentBanner({ settings }: { settings: AnalyticsSettings | null }) {
  const choice = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getConsentServerSnapshot);

  if (!hasAnyAnalyticsService(settings) || choice !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Συναίνεση cookies"
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 border-t border-border bg-bg p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-ink-muted">
        Χρησιμοποιούμε cookies ανάλυσης επισκεψιμότητας για να βελτιώνουμε το κατάστημα. Δεν φορτώνουμε
        κανένα τέτοιο cookie χωρίς τη συγκατάθεσή σου.
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setConsentChoice("rejected")}
          className="rounded-sm border border-border px-4 py-2 text-sm text-ink hover:bg-surface"
        >
          Απόρριψη
        </button>
        <button
          type="button"
          onClick={() => setConsentChoice("accepted")}
          className="rounded-sm bg-ink px-4 py-2 text-sm text-white hover:bg-ink/90"
        >
          Αποδοχή
        </button>
      </div>
    </div>
  );
}
