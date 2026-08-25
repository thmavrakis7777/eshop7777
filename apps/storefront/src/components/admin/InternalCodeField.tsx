"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { checkInternalCodeAction, deleteProductAction } from "@/lib/admin/catalog-actions";

const DEBOUNCE_MS = 400;

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";
const labelCls = "text-sm font-medium text-ink";
const hint = "text-xs text-ink-muted";

type Conflict = { productId: string; productTitle: string } | null;

/**
 * Internal, business-only product code — separate from SKU (see
 * lib/admin/products.ts's ProductInput.internalCode). Debounced live
 * duplicate check as the admin types, same pattern as SearchBox's own
 * debounce (request-id guarded against an out-of-order response). Reused
 * unchanged on both the product editor and the "new product" form —
 * `productId` is only passed on the editor, so a new product's check never
 * excludes itself (it doesn't exist yet to exclude).
 */
export function InternalCodeField({
  productId,
  defaultValue,
}: {
  productId?: string;
  defaultValue: string | null;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [conflict, setConflict] = useState<Conflict>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  const trimmed = value.trim();

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!trimmed) return;
    const currentRequestId = ++requestId.current;
    debounceTimer.current = setTimeout(async () => {
      const result = await checkInternalCodeAction(trimmed, productId);
      if (currentRequestId !== requestId.current) return;
      setConflict(result.available ? null : { productId: result.productId, productTitle: result.productTitle });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [trimmed, productId]);

  // Cleared field → no conflict to show, computed at render time rather than
  // reset in the effect above (same "don't setState synchronously inside an
  // effect" rule this project enforces elsewhere — see WishlistProvider).
  const displayedConflict = trimmed ? conflict : null;

  function confirmDelete() {
    if (!conflict) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteProductAction(conflict.productId);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setShowDeleteConfirm(false);
      setConflict(null);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="internalCode" className={labelCls}>
        Εσωτερικός κωδικός
      </label>
      <div className="flex items-center gap-2">
        <input
          id="internalCode"
          name="internalCode"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="π.χ. MH-00125"
          className={field}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              setConflict(null);
            }}
            className="shrink-0 whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm text-ink-muted hover:bg-surface"
          >
            Αφαίρεση κωδικού
          </button>
        )}
      </div>
      <p className={hint}>
        Εσωτερικός κωδικός επιχείρησης, ξεχωριστός από το SKU — δεν εμφανίζεται ποτέ στον πελάτη.
      </p>

      {displayedConflict && (
        <div className="mt-1 rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm">
          <p className="text-danger">Ο κωδικός χρησιμοποιείται ήδη.</p>
          <p className="mt-0.5 text-ink">
            Χρησιμοποιείται από: <strong>{displayedConflict.productTitle}</strong>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/admin/products/${displayedConflict.productId}`}
              target="_blank"
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-ink hover:bg-surface"
            >
              Προβολή προϊόντος
            </Link>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md border border-danger/40 bg-bg px-3 py-1.5 text-sm text-danger hover:bg-danger/5"
            >
              Διαγραφή προϊόντος
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && displayedConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <button
            type="button"
            aria-label="Άκυρο"
            onClick={() => setShowDeleteConfirm(false)}
            className="absolute inset-0 bg-ink/30"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            className="relative w-full max-w-md rounded-lg border border-border bg-bg p-6"
          >
            <h2 id="delete-product-title" className="font-display text-lg text-ink">
              Οριστική διαγραφή προϊόντος
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Είσαι σίγουρος ότι θέλεις να διαγράψεις οριστικά το{" "}
              <strong className="text-ink">{displayedConflict.productTitle}</strong>; Αν το προϊόν έχει παραγγελίες,
              θα απενεργοποιηθεί αντί να διαγραφεί.
            </p>
            {deleteError && <p className="mt-2 text-sm text-danger">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface"
              >
                Άκυρο
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deletePending}
                className="rounded-md bg-danger px-3.5 py-2 text-sm font-medium text-bg transition-colors hover:bg-danger/90 disabled:opacity-40"
              >
                {deletePending ? "Διαγραφή…" : "Διαγραφή προϊόντος"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
