"use client";

import { useState, useTransition } from "react";
import { requestPasswordResetAction } from "@/lib/actions/customer";

// For an account that signs in with Google and has no password yet. Sends
// the ordinary reset email to the account's own address; its link
// (/logariasmos/nea-kodikos) sets the first password. Same action as
// "Ξέχασες τον κωδικό;", so the same rate limit and the same always-"sent"
// answer apply.
export function SetPasswordByEmail({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    setError(undefined);
    startTransition(async () => {
      const result = await requestPasswordResetAction(email);
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  }

  if (sent) {
    return (
      <p role="status" className="rounded-sm bg-surface px-4 py-3 text-sm text-ink">
        Σου στείλαμε email στο {email} με σύνδεσμο για να ορίσεις κωδικό.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Συνδέεσαι με Google, οπότε ο λογαριασμός σου δεν έχει ακόμη κωδικό. Αν θέλεις να μπαίνεις και με email και
        κωδικό, θα σου στείλουμε σύνδεσμο στο {email} για να ορίσεις έναν.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleSend}
        disabled={isPending}
        className="h-11 rounded-sm bg-ink text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
      >
        {isPending ? "Αποστολή…" : "Στείλε μου σύνδεσμο"}
      </button>
    </div>
  );
}
