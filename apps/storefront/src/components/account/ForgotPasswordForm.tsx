"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FormField } from "@/components/checkout/FormField";
import { requestPasswordResetAction } from "@/lib/actions/customer";
import { isValidEmail } from "@/lib/checkout-validation";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("Μη έγκυρη διεύθυνση email.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      await requestPasswordResetAction(email);
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink">
          Αν υπάρχει λογαριασμός με το email <strong>{email}</strong>, θα λάβεις σύντομα ένα μήνυμα με οδηγίες
          επαναφοράς του κωδικού σου. Ο σύνδεσμος ισχύει για 15 λεπτά.
        </p>
        <Link href="/logariasmos/eisodos" className="text-sm text-accent hover:underline">
          Επιστροφή στη σύνδεση
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-ink-muted">
        Συμπλήρωσε το email του λογαριασμού σου και θα σου στείλουμε σύνδεσμο επαναφοράς κωδικού.
      </p>
      <FormField id="forgot-password-email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="h-11 rounded-sm bg-ink text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
      >
        {isPending ? "Αποστολή…" : "Αποστολή συνδέσμου"}
      </button>
      <Link href="/logariasmos/eisodos" className="text-sm text-ink-muted hover:text-ink hover:underline">
        Επιστροφή στη σύνδεση
      </Link>
    </form>
  );
}
