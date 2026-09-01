"use client";

import { useId, useState, useTransition } from "react";
import { ChevronRightIcon } from "@/components/ui/Icons";
import { subscribeToNewsletterAction } from "@/lib/actions/newsletter";

/**
 * Compact "follow us" signup for the footer — a separate, extra entry point
 * into the same subscription list, not a replacement for the homepage
 * Newsletter section. Reuses subscribeToNewsletterAction (and therefore the
 * same shop.newsletter_subscriber table/confirmation email) so there is only
 * ever one subscription backend; this component owns none of it and the
 * homepage section is never imported or touched here.
 *
 * Consent is implied by the affirmative act of submitting this form next to
 * the Privacy Policy link below it, rather than a second checkbox — keeping
 * this genuinely small the way a footer signup is supposed to be.
 */
export function FooterNewsletterForm() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ kind: "success" | "error"; text: string } | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;
    setResult(undefined);
    startTransition(async () => {
      const res = await subscribeToNewsletterAction({ email, consent: true });
      if (!res.ok) {
        setResult({ kind: "error", text: res.error });
        return;
      }
      if (res.status === "already_subscribed") {
        setResult({ kind: "error", text: "Αυτό το email είναι ήδη εγγεγραμμένο." });
        return;
      }
      setResult({ kind: "success", text: "Ευχαριστούμε για την εγγραφή σας!" });
      setEmail("");
    });
  }

  if (result?.kind === "success") {
    return (
      <p role="status" className="mt-3 text-sm text-ink">
        {result.text}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 max-w-xs">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={id} className="sr-only">
          Email
        </label>
        <input
          id={id}
          type="email"
          required
          disabled={isPending}
          placeholder="Το email σας"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full min-w-0 rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus-visible:border-ink disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-sm bg-ink px-3.5 py-2 text-xs font-medium tracking-wide text-white transition-colors hover:bg-accent disabled:opacity-60"
        >
          {isPending ? (
            "…"
          ) : (
            <>
              ΕΓΓΡΑΦΗ
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
      {result?.kind === "error" && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {result.text}
        </p>
      )}
    </form>
  );
}
