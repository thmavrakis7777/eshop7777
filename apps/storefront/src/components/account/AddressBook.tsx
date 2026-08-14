"use client";

import { useState, useTransition } from "react";
import { AddressForm } from "@/components/account/AddressForm";
import { deleteAddressAction } from "@/lib/actions/customer";
import type { CustomerAddress } from "@/lib/types";

export function AddressBook({ addresses: initialAddresses }: { addresses: CustomerAddress[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSaved(updated: CustomerAddress[]) {
    setAddresses(updated);
    setAdding(false);
    setEditingId(null);
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteAddressAction(id);
      if (result.ok) setAddresses(result.addresses);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {addresses.length === 0 && !adding && (
        <p className="text-sm text-ink-muted">Δεν έχεις αποθηκευμένες διευθύνσεις ακόμα.</p>
      )}

      <ul className="flex flex-col gap-3">
        {addresses.map((address) =>
          editingId === address.id ? (
            <li key={address.id}>
              <AddressForm existing={address} onDone={handleSaved} onCancel={() => setEditingId(null)} />
            </li>
          ) : (
            <li key={address.id} className="flex items-start justify-between gap-4 rounded-sm border border-border p-4">
              <div className="text-sm text-ink">
                {address.label && <p className="mb-1 font-medium">{address.label}</p>}
                <p>
                  {address.firstName} {address.lastName}
                </p>
                <p className="text-ink-muted">
                  {/* `number` is empty for a saved address — Οδός and Αριθμός are
                      stored combined in one column and splitting them back apart
                      is not reliably reversible. Joining on filtered parts keeps
                      that from rendering as a stray space before the comma. */}
                  {[[address.street, address.number].filter(Boolean).join(" "), address.area]
                    .filter(Boolean)
                    .join(", ")}
                  <br />
                  {address.postalCode} {address.city}
                  {address.phone && (
                    <>
                      <br />
                      {address.phone}
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-3 text-sm">
                <button type="button" onClick={() => setEditingId(address.id)} className="text-accent hover:underline">
                  Επεξεργασία
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDelete(address.id)}
                  className="text-danger hover:underline disabled:opacity-60"
                >
                  Διαγραφή
                </button>
              </div>
            </li>
          )
        )}
      </ul>

      {adding ? (
        <AddressForm onDone={handleSaved} onCancel={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-11 w-fit rounded-sm border border-border px-6 text-sm text-ink transition-colors hover:border-ink"
        >
          + Προσθήκη διεύθυνσης
        </button>
      )}
    </div>
  );
}
