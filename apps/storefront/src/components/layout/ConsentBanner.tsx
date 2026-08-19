"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  getConsentServerSnapshot,
  getConsentSnapshot,
  getSettingsOpenServerSnapshot,
  getSettingsOpenSnapshot,
  setConsentChoices,
  subscribeConsent,
  subscribeSettingsOpen,
  type ConsentCategories,
} from "@/lib/consent-storage";
import { hasAnalyticsService, hasAnyAnalyticsService, hasMarketingService, type AnalyticsSettings } from "@/lib/content-types";

const ALL_ON: ConsentCategories = { analytics: true, marketing: true };
const ALL_OFF: ConsentCategories = { analytics: false, marketing: false };

/**
 * Cookie consent — shows on first visit (no stored choice yet), and again
 * any time the footer's "Ρυθμίσεις Cookies" link calls requestSettingsOpen
 * (see consent-storage.ts). Same component both times, seeded with the
 * visitor's current choice as defaults on reopen so changing your mind
 * doesn't mean starting from scratch.
 *
 * Two real categories, not the generic four some cookie banners show —
 * Necessary cookies aren't optional (nothing to toggle) and there's no
 * Preferences cookie anywhere in this codebase to gate (see the long note
 * in consent-storage.ts). Offering a toggle for a category with nothing
 * behind it would be a fake choice, not a real one.
 */
export function ConsentBanner({ settings }: { settings: AnalyticsSettings | null }) {
  const choice = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getConsentServerSnapshot);
  const settingsOpen = useSyncExternalStore(subscribeSettingsOpen, getSettingsOpenSnapshot, getSettingsOpenServerSnapshot);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<ConsentCategories>(choice ?? ALL_OFF);

  const analyticsAvailable = hasAnalyticsService(settings);
  const marketingAvailable = hasMarketingService(settings);

  if (!hasAnyAnalyticsService(settings)) return null;
  const visible = choice === null || settingsOpen;
  if (!visible) return null;

  const openCustomize = () => {
    setDraft(choice ?? ALL_OFF);
    setCustomizing(true);
  };

  return (
    <div
      role="dialog"
      aria-label="Ρυθμίσεις cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-bg p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] sm:p-5"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {!customizing ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-muted">
              Χρησιμοποιούμε cookies ανάλυσης και, όπου ισχύει, διαφήμισης για να βελτιώνουμε το κατάστημα. Δεν
              φορτώνουμε κανένα τέτοιο cookie χωρίς τη συγκατάθεσή σου — δες την{" "}
              <Link href="/cookies" className="underline underline-offset-2 hover:text-ink">
                Πολιτική Cookies
              </Link>
              .
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={openCustomize}
                className="rounded-sm border border-border px-4 py-2 text-sm text-ink hover:bg-surface"
              >
                Προσαρμογή
              </button>
              <button
                type="button"
                onClick={() => setConsentChoices(ALL_OFF)}
                className="rounded-sm border border-border px-4 py-2 text-sm text-ink hover:bg-surface"
              >
                Απόρριψη
              </button>
              <button
                type="button"
                onClick={() => setConsentChoices(ALL_ON)}
                className="rounded-sm bg-ink px-4 py-2 text-sm text-white hover:bg-ink/90"
              >
                Αποδοχή όλων
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">Επίλεξε ποιες κατηγορίες cookies επιτρέπεις.</p>
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked disabled className="mt-0.5 h-4 w-4 accent-ink" />
                <span>
                  <span className="font-medium text-ink">Απαραίτητα</span>
                  <span className="block text-ink-muted">
                    Καλάθι, σύνδεση λογαριασμού, ασφάλεια. Πάντα ενεργά — δεν χρειάζονται συγκατάθεση.
                  </span>
                </span>
              </label>
              {analyticsAvailable && (
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.analytics}
                    onChange={(e) => setDraft((d) => ({ ...d, analytics: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 accent-ink"
                  />
                  <span>
                    <span className="font-medium text-ink">Ανάλυση (Analytics)</span>
                    <span className="block text-ink-muted">Google Analytics, Microsoft Clarity — στατιστικά επισκεψιμότητας.</span>
                  </span>
                </label>
              )}
              {marketingAvailable && (
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.marketing}
                    onChange={(e) => setDraft((d) => ({ ...d, marketing: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 accent-ink"
                  />
                  <span>
                    <span className="font-medium text-ink">Marketing</span>
                    <span className="block text-ink-muted">Meta Pixel — μέτρηση αποτελεσματικότητας διαφημίσεων.</span>
                  </span>
                </label>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCustomizing(false)}
                className="rounded-sm border border-border px-4 py-2 text-sm text-ink hover:bg-surface"
              >
                Πίσω
              </button>
              <button
                type="button"
                onClick={() => {
                  setConsentChoices(draft);
                  setCustomizing(false);
                }}
                className="rounded-sm bg-ink px-4 py-2 text-sm text-white hover:bg-ink/90"
              >
                Αποθήκευση επιλογών
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
