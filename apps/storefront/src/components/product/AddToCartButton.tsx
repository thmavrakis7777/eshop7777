"use client";

export function AddToCartButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={(e) => e.preventDefault()}>
      Προσθήκη στο καλάθι
    </button>
  );
}
