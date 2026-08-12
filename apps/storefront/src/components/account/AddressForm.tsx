"use client";

import { useState, useTransition } from "react";
import { FormField } from "@/components/checkout/FormField";
import { addAddressAction, updateAddressAction } from "@/lib/actions/customer";
import { isRequired, isValidPostalCode, isValidPhone } from "@/lib/checkout-validation";
import type { Address, CustomerAddress } from "@/lib/types";

const EMPTY: Address = {
  firstName: "",
  lastName: "",
  street: "",
  number: "",
  area: "",
  city: "",
  postalCode: "",
  countryCode: "gr",
  phone: "",
};

// Add and edit share one form — matches AddressSection's Greek Οδός/Αριθμός
// split (see lib/types.ts's Address comment) but with its own local state
// rather than checkout's per-field autosave, since this is a plain
// add/save form, not a live-editing session.
export function AddressForm({
  existing,
  onDone,
  onCancel,
}: {
  existing?: CustomerAddress;
  onDone: (addresses: CustomerAddress[]) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? "");
  const [values, setValues] = useState<Address>(existing ?? EMPTY);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof Address>(field: K, value: Address[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !isRequired(values.firstName) ||
      !isRequired(values.lastName) ||
      !isRequired(values.street) ||
      !isRequired(values.city) ||
      !isValidPostalCode(values.postalCode)
    ) {
      setError("Συμπλήρωσε σωστά όλα τα υποχρεωτικά πεδία.");
      return;
    }
    if (values.phone && !isValidPhone(values.phone)) {
      setError("Μη έγκυρο τηλέφωνο.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = existing
        ? await updateAddressAction(existing.id, values, label)
        : await addAddressAction(values, label);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone(result.addresses);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-sm border border-border p-4" noValidate>
      <FormField id="address-label" label="Ετικέτα (π.χ. Σπίτι, Δουλειά — προαιρετικό)" value={label} onChange={setLabel} />
      <div className="grid grid-cols-2 gap-3">
        <FormField id="address-first-name" label="Όνομα" value={values.firstName} onChange={(v) => update("firstName", v)} />
        <FormField id="address-last-name" label="Επώνυμο" value={values.lastName} onChange={(v) => update("lastName", v)} />
      </div>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <FormField id="address-street" label="Οδός" value={values.street} onChange={(v) => update("street", v)} />
        <FormField id="address-number" label="Αριθμός" value={values.number} onChange={(v) => update("number", v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField id="address-postal-code" label="ΤΚ" inputMode="numeric" value={values.postalCode} onChange={(v) => update("postalCode", v)} />
        <FormField id="address-city" label="Πόλη" value={values.city} onChange={(v) => update("city", v)} />
      </div>
      <FormField id="address-area" label="Περιοχή (προαιρετικό)" value={values.area ?? ""} onChange={(v) => update("area", v)} />
      <FormField id="address-phone" label="Τηλέφωνο (προαιρετικό)" inputMode="tel" value={values.phone} onChange={(v) => update("phone", v)} />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="h-11 rounded-sm bg-ink px-6 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
        >
          {isPending ? "Αποθήκευση…" : "Αποθήκευση διεύθυνσης"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-sm border border-border px-6 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          Ακύρωση
        </button>
      </div>
    </form>
  );
}
