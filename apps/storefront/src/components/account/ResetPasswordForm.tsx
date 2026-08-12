"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/checkout/FormField";
import { confirmPasswordResetAction } from "@/lib/actions/customer";
import { isValidPassword } from "@/lib/checkout-validation";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPassword(password)) {
      setError("Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Οι κωδικοί δεν ταιριάζουν.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await confirmPasswordResetAction({ token, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/logariasmos/eisodos?reset=success");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormField
        id="reset-password-new"
        label="Νέος κωδικός πρόσβασης"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
      />
      <FormField
        id="reset-password-confirm"
        label="Επιβεβαίωση κωδικού"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
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
        {isPending ? "Αποθήκευση…" : "Ορισμός νέου κωδικού"}
      </button>
    </form>
  );
}
