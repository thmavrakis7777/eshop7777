"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { requestStockNotificationAction } from "@/lib/actions/stock-notification";

/**
 * «Ενημέρωσέ με όταν παραληφθεί» — shown on the product page under the
 * disabled «Εξαντλήθηκε» button, for the selected sold-out variant only.
 * Styled after FooterNewsletterForm so the two email fields on the site look
 * like one family. The parent keys this by variant, so switching variants
 * starts a fresh form.
 */
export function NotifyWhenAvailableForm({ variantId }: { variantId: string }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await requestStockNotificationAction({ variantId, email });
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <p role="status" className="rounded-sm border border-border bg-surface px-3.5 py-3 text-sm text-ink">
        Θα σου στείλουμε email μόλις το προϊόν είναι ξανά διαθέσιμο.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-sm border border-border px-3.5 py-3">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Ενημέρωσέ με όταν παραληφθεί
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type="email"
          required
          autoComplete="email"
          disabled={isPending}
          placeholder="Το email σας"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full min-w-0 rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus-visible:border-ink disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-sm bg-ink px-4 py-2 text-xs font-medium tracking-wide text-white transition-colors hover:bg-accent disabled:opacity-60"
        >
          {isPending ? "…" : "Ενημέρωσέ με"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <p className="text-[11px] text-ink-muted">
        Το email σου χρησιμοποιείται μόνο για να σε ενημερώσουμε όταν το προϊόν είναι ξανά διαθέσιμο και
        διαγράφεται μόλις σταλεί η ειδοποίηση.{" "}
        <Link href="/aporrito" className="underline hover:text-ink">
          Πολιτική Απορρήτου
        </Link>
      </p>
    </form>
  );
}
