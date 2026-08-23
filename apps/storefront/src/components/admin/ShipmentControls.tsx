"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resendShipmentEmailAction, saveShipmentInfoAction } from "@/lib/admin/sales-actions";

/**
 * Suggestions only (a <datalist>, not a locked dropdown) — this store's
 * actual courier isn't confirmed, and no verified official tracking-URL
 * format exists for any of these to auto-generate a link from (see
 * 0015_shipment_tracking.sql). The admin can type any name; a link only
 * ever appears if they also paste a real tracking URL themselves.
 */
const COURIER_SUGGESTIONS = ["ACS", "Γενική Ταχυδρομική", "ΕΛΤΑ Courier", "Speedex", "Courier Center"];

const dateTimeFmt = new Intl.DateTimeFormat("el-GR", { dateStyle: "short", timeStyle: "short" });

const input =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink disabled:opacity-50";

function EmailStatus({ label, sentAt }: { label: string; sentAt: string | null }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-ink-muted">{label}</span>
      {sentAt ? (
        <span className="text-ink">Στάλθηκε · {dateTimeFmt.format(new Date(sentAt))}</span>
      ) : (
        <span className="text-ink-muted">Δεν στάλθηκε</span>
      )}
    </div>
  );
}

export function ShipmentControls({
  orderId,
  courierName,
  trackingCode,
  trackingUrl,
  confirmationEmailSentAt,
  shipmentEmailSentAt,
}: {
  orderId: string;
  courierName: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  confirmationEmailSentAt: string | null;
  shipmentEmailSentAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmResend, setConfirmResend] = useState(false);
  const [courier, setCourier] = useState(courierName ?? "");
  const [tracking, setTracking] = useState(trackingCode ?? "");
  const [url, setUrl] = useState(trackingUrl ?? "");

  const dirty = courier !== (courierName ?? "") || tracking !== (trackingCode ?? "") || url !== (trackingUrl ?? "");
  const canResend = Boolean(courier.trim() && tracking.trim());

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      setMsg(result.ok ? { ok: true, text: result.message ?? "Έγινε." } : { ok: false, text: result.error ?? "" });
      if (result.ok) {
        setConfirmResend(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>
          {msg.text}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="courier-name" className="text-sm font-medium text-ink">
          Εταιρεία μεταφοράς
        </label>
        <input
          id="courier-name"
          list="courier-suggestions"
          value={courier}
          disabled={pending}
          onChange={(e) => setCourier(e.target.value)}
          placeholder="π.χ. ACS"
          className={input}
        />
        <datalist id="courier-suggestions">
          {COURIER_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tracking-code" className="text-sm font-medium text-ink">
          Κωδικός αποστολής
        </label>
        <input
          id="tracking-code"
          value={tracking}
          disabled={pending}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="π.χ. 1234567890"
          className={input}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tracking-url" className="text-sm font-medium text-ink">
          Tracking URL <span className="font-normal text-ink-muted">(προαιρετικό)</span>
        </label>
        <input
          id="tracking-url"
          type="url"
          value={url}
          disabled={pending}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className={input}
        />
        <p className="text-xs text-ink-muted">
          Αν το αφήσεις κενό, το email θα δείχνει μόνο τον κωδικό αποστολής, χωρίς κουμπί παρακολούθησης.
        </p>
      </div>

      <button
        type="button"
        disabled={pending || !dirty}
        onClick={() => run(() => saveShipmentInfoAction(orderId, courier, tracking, url))}
        className="self-start rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-40"
      >
        Αποθήκευση στοιχείων αποστολής
      </button>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <EmailStatus label="Email επιβεβαίωσης" sentAt={confirmationEmailSentAt} />
        <EmailStatus label="Email αποστολής" sentAt={shipmentEmailSentAt} />

        <button
          type="button"
          disabled={pending || !canResend}
          onClick={() => setConfirmResend(true)}
          className="mt-1 self-start rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-40"
          title={canResend ? undefined : "Χρειάζονται εταιρεία μεταφοράς και κωδικός αποστολής"}
        >
          Επαναποστολή email αποστολής
        </button>
      </div>

      {confirmResend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <button
            type="button"
            aria-label="Άκυρο"
            onClick={() => setConfirmResend(false)}
            className="absolute inset-0 bg-ink/30"
          />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-lg border border-border bg-bg p-6">
            <h2 className="font-display text-lg text-ink">Επαναποστολή email αποστολής</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Ο πελάτης θα λάβει ξανά το email αποστολής με τα τρέχοντα αποθηκευμένα στοιχεία
              (εταιρεία μεταφοράς, κωδικός αποστολής).
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmResend(false)}
                className="rounded-md border border-border px-3.5 py-2 text-sm font-medium hover:bg-surface"
              >
                Πίσω
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => resendShipmentEmailAction(orderId))}
                className="rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-white hover:bg-accent disabled:opacity-50"
              >
                {pending ? "Αποστολή…" : "Αποστολή email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
