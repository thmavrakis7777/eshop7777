"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProductAction } from "@/lib/admin/catalog-actions";

// Typing a word back proves intent — same reasoning as the bulk list's typed
// count (ProductListTable's ConfirmDialog): a plain "are you sure?" gets
// clicked through. Compared accent- and case-insensitively, so «Διαγραφή»,
// «ΔΙΑΓΡΑΦΗ» and «διαγραφη» all confirm; the point is intent, not where the
// Greek keyboard puts the accent.
const CONFIRM_WORD = "ΔΙΑΓΡΑΦΗ";
const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").trim().toLocaleUpperCase("el");

/**
 * Delete from the product's own edit page (QA-017) — before this, deleting
 * meant going back to the list and bulk-selecting one row.
 *
 * Rendered outside ProductEditor's <form> on purpose: typing in the confirm
 * box must not flag the product form as having unsaved changes, and Enter
 * must never submit a product save. deleteProductAction keeps its
 * order-history guard — a product that appears in any order is deactivated
 * instead of deleted — and this panel says which of the two happened.
 */
export function DeleteProductPanel({ productId, productTitle }: { productId: string; productTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const matches = normalize(value) === CONFIRM_WORD;

  function close() {
    if (pending) return;
    setOpen(false);
    setValue("");
    setError(null);
  }

  function confirm() {
    if (!matches || pending) return;
    startTransition(async () => {
      const result = await deleteProductAction(productId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.deleted) {
        // This page's product no longer exists — a refresh here would 404.
        router.push("/admin/products");
        return;
      }
      setOpen(false);
      setValue("");
      setNotice(result.message);
      router.refresh();
    });
  }

  return (
    <section className="mt-5 rounded-lg border border-danger/30 bg-bg p-5">
      <h2 className="text-sm font-semibold tracking-wide text-danger uppercase">Διαγραφή προϊόντος</h2>
      <p className="mt-1 max-w-prose text-xs text-ink-muted">
        Αφαιρεί οριστικά το προϊόν από το κατάστημα. Αν το προϊόν υπάρχει σε έστω και μία παραγγελία,
        απενεργοποιείται αντί να διαγραφεί, ώστε να μη χαθεί το ιστορικό πωλήσεων.
      </p>
      {notice && (
        <p role="status" className="mt-3 text-sm text-success">
          {notice}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          setNotice(null);
          setOpen(true);
        }}
        className="mt-4 rounded-md border border-danger/40 px-3.5 py-1.5 text-sm font-medium text-danger hover:bg-danger/5"
      >
        Διαγραφή προϊόντος…
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-5"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <button type="button" aria-label="Άκυρο" onClick={close} className="absolute inset-0 bg-ink/30" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            className="relative w-full max-w-md rounded-lg border border-border bg-bg p-6"
          >
            <h2 id="delete-product-title" className="font-display text-lg text-ink">
              Διαγραφή προϊόντος
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Το «{productTitle}» θα διαγραφεί οριστικά. Η ενέργεια δεν αναιρείται.
            </p>
            <label htmlFor="delete-product-confirm" className="mt-4 block text-sm text-ink">
              Πληκτρολόγησε <strong>{CONFIRM_WORD}</strong> για επιβεβαίωση
            </label>
            <input
              id="delete-product-confirm"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirm();
                }
              }}
              autoFocus
              autoComplete="off"
              className="mt-1.5 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
            />
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface"
              >
                Άκυρο
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!matches || pending}
                className="rounded-md bg-danger px-3.5 py-2 text-sm font-medium text-bg transition-colors hover:bg-danger/90 disabled:opacity-40"
              >
                {pending ? "Διαγραφή…" : "Διαγραφή"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
