"use client";

import { useState, useTransition } from "react";
import { FormField } from "@/components/checkout/FormField";
import { changePasswordAction } from "@/lib/actions/customer";
import { isValidPassword, isRequired } from "@/lib/checkout-validation";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    if (!isRequired(currentPassword)) {
      setError("Συμπλήρωσε τον τρέχοντα κωδικό.");
      return;
    }
    if (!isValidPassword(newPassword)) {
      setError("Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Οι νέοι κωδικοί δεν ταιριάζουν.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await changePasswordAction({ currentPassword, newPassword });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormField
        id="change-password-current"
        label="Τρέχων κωδικός"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={setCurrentPassword}
      />
      <FormField
        id="change-password-new"
        label="Νέος κωδικός (τουλάχιστον 8 χαρακτήρες)"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={setNewPassword}
      />
      <FormField
        id="change-password-confirm"
        label="Επιβεβαίωση νέου κωδικού"
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
      {success && (
        <p role="status" className="text-sm text-ink">
          Ο κωδικός σου ενημερώθηκε.
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="h-11 w-fit rounded-sm bg-ink px-6 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
      >
        {isPending ? "Αποθήκευση…" : "Αλλαγή κωδικού"}
      </button>
    </form>
  );
}
