"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormField } from "@/components/checkout/FormField";
import { registerAction } from "@/lib/actions/customer";
import { isValidEmail, isValidPassword, isRequired } from "@/lib/checkout-validation";

export function RegisterForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isRequired(firstName) || !isRequired(lastName)) {
      setError("Συμπλήρωσε όνομα και επώνυμο.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Μη έγκυρη διεύθυνση email.");
      return;
    }
    if (!isValidPassword(password)) {
      setError("Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await registerAction({ email, password, firstName, lastName });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <FormField id="register-first-name" label="Όνομα" autoComplete="given-name" value={firstName} onChange={setFirstName} />
        <FormField id="register-last-name" label="Επώνυμο" autoComplete="family-name" value={lastName} onChange={setLastName} />
      </div>
      <FormField id="register-email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
      <FormField
        id="register-password"
        label="Κωδικός πρόσβασης (τουλάχιστον 8 χαρακτήρες)"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
      />
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
        {isPending ? "Δημιουργία…" : "Δημιουργία λογαριασμού"}
      </button>
      <p className="text-sm text-ink-muted">
        Έχεις ήδη λογαριασμό;{" "}
        <Link href="/logariasmos/eisodos" className="text-accent hover:underline">
          Σύνδεση
        </Link>
      </p>
    </form>
  );
}
