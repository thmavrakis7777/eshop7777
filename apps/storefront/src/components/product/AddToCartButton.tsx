"use client";

import { useState, useTransition } from "react";
import { addLineItemAction } from "@/lib/actions/cart";
import { useCartUI } from "@/components/cart/CartUIProvider";

export function AddToCartButton({
  variantId,
  className,
}: {
  variantId: string;
  className?: string;
}) {
  const { showAddedToast } = useCartUI();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await addLineItemAction(variantId, 1);
      if (result.ok) {
        showAddedToast();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" className={className} onClick={handleClick} disabled={isPending}>
        {isPending ? "Προσθήκη…" : "Προσθήκη στο καλάθι"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
