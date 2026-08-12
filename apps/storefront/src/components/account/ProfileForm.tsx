"use client";

import { useState, useTransition } from "react";
import { FormField } from "@/components/checkout/FormField";
import { updateProfileAction } from "@/lib/actions/customer";
import { isRequired, isValidPhone } from "@/lib/checkout-validation";
import type { Customer } from "@/lib/types";

export function ProfileForm({ customer }: { customer: Customer }) {
  const [firstName, setFirstName] = useState(customer.firstName);
  const [lastName, setLastName] = useState(customer.lastName);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    if (!isRequired(firstName) || !isRequired(lastName)) {
      setError("Συμπλήρωσε όνομα και επώνυμο.");
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError("Μη έγκυρο τηλέφωνο.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await updateProfileAction({ firstName, lastName, phone });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <FormField id="profile-first-name" label="Όνομα" autoComplete="given-name" value={firstName} onChange={setFirstName} />
        <FormField id="profile-last-name" label="Επώνυμο" autoComplete="family-name" value={lastName} onChange={setLastName} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-ink-muted">Email</label>
        <p className="text-sm text-ink-muted">{customer.email}</p>
      </div>
      <FormField id="profile-phone" label="Τηλέφωνο (προαιρετικό)" inputMode="tel" autoComplete="tel" value={phone} onChange={setPhone} />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-ink">
          Οι αλλαγές αποθηκεύτηκαν.
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="h-11 w-fit rounded-sm bg-ink px-6 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
      >
        {isPending ? "Αποθήκευση…" : "Αποθήκευση αλλαγών"}
      </button>
    </form>
  );
}
