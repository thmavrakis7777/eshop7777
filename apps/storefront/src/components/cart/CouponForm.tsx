"use client";

import { useState } from "react";
import type { AppliedPromotion, Money } from "@/lib/types";
import { formatPrice } from "@/lib/format";

// Collapsed by default behind a plain toggle — a permanently-open input with
// its own "Apply" button would visually compete with the checkout CTA
// (CART_UX_SPEC.md §7). One promo code at a time keeps this in line with
// what's actually been verified against the live Store API this session.
export function CouponForm({
  promotions,
  discountTotal,
  pending,
  onApply,
  onRemove,
}: {
  promotions: AppliedPromotion[];
  discountTotal: Money;
  pending: boolean;
  onApply: (code: string, onSettled: (ok: boolean, error?: string) => void) => void;
  onRemove: (code: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const applied = promotions[0];

  if (applied) {
    return (
      <div className="flex flex-col gap-1.5 rounded-sm bg-surface px-3 py-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-muted">Κωδικός:</span>
          <span className="font-medium text-ink">{applied.code}</span>
        </div>
        {discountTotal.amount > 0 && (
          <div className="flex justify-between">
            <span className="text-ink-muted">Έκπτωση:</span>
            <span className="text-ink tabular-nums">−{formatPrice(discountTotal)}</span>
          </div>
        )}
        <button
          type="button"
          className="w-fit text-ink-muted hover:text-ink hover:underline disabled:opacity-50"
          disabled={pending}
          onClick={() => onRemove(applied.code)}
        >
          Αφαίρεση
        </button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button type="button" className="text-sm text-ink-muted hover:text-ink hover:underline" onClick={() => setExpanded(true)}>
        Κωδικός έκπτωσης
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!code.trim() || pending) return;
        setError(null);
        onApply(code.trim(), (ok, err) => {
          if (ok) {
            setCode("");
            setExpanded(false);
          } else {
            setError(err ?? "Κάτι πήγε στραβά. Δοκίμασε ξανά.");
          }
        });
      }}
    >
      <div className="flex gap-2">
        <label htmlFor="coupon-code" className="sr-only">
          Κωδικός κουπονιού
        </label>
        <input
          id="coupon-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Κωδικός κουπονιού"
          className="min-w-0 flex-1 rounded-sm border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          disabled={pending}
        />
        <button
          type="submit"
          className="shrink-0 rounded-sm border border-ink px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
          disabled={pending || !code.trim()}
        >
          {pending ? "…" : "Εφαρμογή"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
